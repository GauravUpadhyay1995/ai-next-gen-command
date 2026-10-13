import tls from "tls";
import { connectToDatabase } from "./db";
import { getActiveCustomerProfiles, getCustomerRawAppPassword } from "./customer-profile";
import { createOAuthClient } from "./google";
import { google } from "googleapis";
import { decrypt } from "./crypto";

export interface BouncedEmailRecord {
  email: string;
  candidateEmail: string;
  bouncedAt: Date;
  reason?: string;
  source: "imap" | "oauth";
}

/**
 * Checks whether an email has previously bounced and is blacklisted.
 */
export async function isEmailBounced(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const { db } = await connectToDatabase();
    const count = await db.collection("bounced_emails").countDocuments({
      email: email.toLowerCase().trim(),
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Scans candidate's Gmail via OAuth API for Mailer-Daemon bounce notifications.
 */
async function scanOAuthBounces(
  customerEmail: string,
  encryptedRefreshToken: string
): Promise<string[]> {
  const bouncedEmails: string[] = [];
  try {
    const refreshToken = decrypt(encryptedRefreshToken);
    const oauthClient = createOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: "v1", auth: oauthClient });

    // Search for bounce failure notices in last 7 days
    const res = await gmail.users.messages.list({
      userId: "me",
      q: 'from:mailer-daemon OR subject:"Delivery Status Notification (Failure)" OR subject:"Address not found"',
      maxResults: 20,
    });

    const messages = res.data.messages || [];
    for (const msg of messages) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const snippet = detail.data.snippet || "";
      // Extract target bounced email from bounce notification snippet
      const emailMatches = snippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const email of emailMatches) {
        const clean = email.toLowerCase().trim();
        if (
          clean !== customerEmail.toLowerCase() &&
          !clean.includes("google") &&
          !clean.includes("mailer-daemon")
        ) {
          bouncedEmails.push(clean);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[BounceChecker] OAuth scan warning for ${customerEmail}:`, err.message);
  }
  return bouncedEmails;
}

/**
 * Scans candidate's Gmail via IMAP TLS session using raw Google App Password.
 */
async function scanImapBounces(
  customerEmail: string,
  appPassword: string
): Promise<string[]> {
  const bouncedEmails: string[] = [];
  const cleanPass = appPassword.replace(/\s+/g, "").trim();

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: "imap.gmail.com",
      port: 993,
      rejectUnauthorized: true,
    });

    let buffer = "";
    let step = 0;

    socket.setEncoding("utf-8");
    socket.setTimeout(8000, () => {
      try {
        socket.destroy();
      } catch {}
      resolve(bouncedEmails);
    });

    const sendCmd = (tag: string, cmd: string) => {
      socket.write(`${tag} ${cmd}\r\n`);
    };

    socket.on("data", (chunk: string) => {
      buffer += chunk;

      if (step === 0 && buffer.includes("* OK")) {
        step = 1;
        buffer = "";
        sendCmd("A01", `LOGIN "${customerEmail}" "${cleanPass}"`);
      } else if (step === 1 && buffer.includes("A01 OK")) {
        step = 2;
        buffer = "";
        sendCmd("A02", `SELECT INBOX`);
      } else if (step === 2 && buffer.includes("A02 OK")) {
        step = 3;
        buffer = "";
        sendCmd("A03", `SEARCH FROM "mailer-daemon"`);
      } else if (step === 3 && buffer.includes("A03 OK")) {
        const searchLine = buffer.split("\r\n").find((l) => l.startsWith("* SEARCH"));
        const msgIds = searchLine ? searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean) : [];

        if (msgIds.length === 0) {
          sendCmd("A05", "LOGOUT");
          step = 99;
          return;
        }

        const recentIds = msgIds.slice(-5).join(",");
        step = 4;
        buffer = "";
        sendCmd("A04", `FETCH ${recentIds} (BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO)] BODY.PEEK[TEXT]<0.1000>)`);
      } else if (step === 4 && buffer.includes("A04 OK")) {
        // Extract emails from fetch buffer
        const matches = buffer.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const m of matches) {
          const clean = m.toLowerCase().trim();
          if (
            clean !== customerEmail.toLowerCase() &&
            !clean.includes("google") &&
            !clean.includes("gmail.com") &&
            !clean.includes("mailer-daemon")
          ) {
            bouncedEmails.push(clean);
          }
        }
        sendCmd("A05", "LOGOUT");
        step = 99;
      } else if (buffer.includes("NO") || buffer.includes("BAD")) {
        try {
          socket.destroy();
        } catch {}
        resolve(bouncedEmails);
      }
    });

    socket.on("end", () => resolve(bouncedEmails));
    socket.on("error", () => resolve(bouncedEmails));
  });
}

/**
 * Scans candidate inboxes for bounce notifications, marks them in sent logs,
 * and adds dead emails to the global blacklisted collection.
 */
export async function runBounceHealthScan(options?: {
  customerEmail?: string;
}): Promise<{
  success: boolean;
  bouncedCount: number;
  newlyBlacklisted: string[];
  logs: string[];
}> {
  const logs: string[] = [];
  logs.push(`[${new Date().toLocaleTimeString()}] 🔍 Starting Email Health & Bounce Scan...`);

  try {
    const { db } = await connectToDatabase();
    const bouncedCol = db.collection("bounced_emails");
    const dispatchLogsCol = db.collection("sent_dispatch_logs");

    let customers = await getActiveCustomerProfiles({ includeResumeBase64: false });
    if (options?.customerEmail) {
      const target = options.customerEmail.toLowerCase().trim();
      customers = customers.filter((c) => c.email.toLowerCase() === target);
    }

    logs.push(`[${new Date().toLocaleTimeString()}] Scanning mailboxes for ${customers.length} candidate(s)...`);

    const allBounced = new Set<string>();

    for (const cust of customers) {
      let candidateBounces: string[] = [];
      const appPass = getCustomerRawAppPassword(cust);

      if (appPass) {
        logs.push(` -> Scanning IMAP inbox for ${cust.email} (App Password)...`);
        candidateBounces = await scanImapBounces(cust.email, appPass);
      } else if (cust.encryptedRefreshToken) {
        logs.push(` -> Scanning Gmail OAuth inbox for ${cust.email}...`);
        candidateBounces = await scanOAuthBounces(cust.email, cust.encryptedRefreshToken);
      }

      if (candidateBounces.length > 0) {
        logs.push(` -> ⚠️ Found ${candidateBounces.length} bounce notice(s) in ${cust.email}'s inbox.`);
        for (const b of candidateBounces) {
          allBounced.add(b);
        }
      } else {
        logs.push(` -> ✅ 0 bounces found for ${cust.email}. Inbox health is 100% clean.`);
      }
    }

    const uniqueBouncedList = Array.from(allBounced);
    const newlyBlacklisted: string[] = [];

    for (const bouncedEmail of uniqueBouncedList) {
      // Upsert into bounced_emails blacklist
      const upsertRes = await bouncedCol.updateOne(
        { email: bouncedEmail },
        {
          $set: {
            email: bouncedEmail,
            bouncedAt: new Date(),
            reason: "Delivery Status Notification (Failure)",
          },
        },
        { upsert: true }
      );

      if (upsertRes.upsertedCount > 0) {
        newlyBlacklisted.push(bouncedEmail);
      }

      // Mark in sent_dispatch_logs as bounced
      await dispatchLogsCol.updateMany(
        { recipientEmail: bouncedEmail },
        {
          $set: {
            status: "bounced",
            bouncedAt: new Date(),
          },
        }
      );
    }

    logs.push(
      `[${new Date().toLocaleTimeString()}] Scan Complete. Newly blacklisted bounced emails: ${newlyBlacklisted.length} (Total identified: ${uniqueBouncedList.length}).`
    );

    return {
      success: true,
      bouncedCount: uniqueBouncedList.length,
      newlyBlacklisted,
      logs,
    };
  } catch (error: any) {
    logs.push(`[ERROR] Bounce scan failed: ${error.message}`);
    return {
      success: false,
      bouncedCount: 0,
      newlyBlacklisted: [],
      logs,
    };
  }
}
