import dns from "dns";
import net from "net";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "tempmail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "temp-mail.org",
  "fakeinbox.com",
  "burnermail.io",
  "mytemp.email",
  "fakemailgenerator.com",
]);

export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email.trim().toLowerCase());
}

export function isDisposableDomain(email: string): boolean {
  try {
    const domain = email.split("@")[1]?.toLowerCase().trim();
    if (!domain) return true;
    return DISPOSABLE_DOMAINS.has(domain);
  } catch {
    return true;
  }
}

/**
 * Performs a zero-send SMTP handshake (HELO -> MAIL FROM -> RCPT TO) to verify if a mailbox actually exists.
 * Gracefully falls back to active MX if Port 25 is blocked by ISP/serverless environments.
 */
export async function pingMailboxSmtp(
  email: string,
  mxHost: string,
  timeoutMs = 2500
): Promise<{ valid: boolean; code?: number; note?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    let socket: net.Socket;

    const finish = (result: { valid: boolean; code?: number; note?: string }) => {
      if (!resolved) {
        resolved = true;
        try {
          if (socket) socket.destroy();
        } catch {}
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      finish({ valid: true, note: "SMTP ping timeout - fallback to active MX" });
    }, timeoutMs);

    try {
      socket = net.createConnection({ host: mxHost, port: 25 });
    } catch (err: any) {
      clearTimeout(timer);
      return resolve({ valid: true, note: `Socket error (${err.message}) - fallback to active MX` });
    }

    let step = 0;
    socket.setEncoding("utf-8");
    socket.setTimeout(timeoutMs);

    socket.on("error", (err) => {
      clearTimeout(timer);
      // If port 25 is blocked by ISP or host (very common), fallback to active MX without breaking
      finish({ valid: true, note: `Port 25 unreachable (${err.message}) - fallback to active MX` });
    });

    socket.on("timeout", () => {
      clearTimeout(timer);
      finish({ valid: true, note: "SMTP timeout - fallback to active MX" });
    });

    socket.on("data", (data) => {
      const line = data.toString();
      const code = parseInt(line.slice(0, 3), 10);

      if (step === 0) {
        // Welcome message from server
        step = 1;
        socket.write(`HELO fetchmail.local\r\n`);
      } else if (step === 1) {
        // HELO ack
        step = 2;
        socket.write(`MAIL FROM:<verify@fetchmail.local>\r\n`);
      } else if (step === 2) {
        // MAIL FROM ack
        step = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 3) {
        // RCPT TO response: 250 = valid, 550 = mailbox does not exist
        clearTimeout(timer);
        try {
          socket.write(`QUIT\r\n`);
        } catch {}

        if (code === 250 || code === 251) {
          finish({ valid: true, code, note: "Mailbox exists (250 OK)" });
        } else if (code >= 550 && code <= 554) {
          finish({ valid: false, code, note: `Mailbox rejected (${code})` });
        } else {
          // Greylisting / temp 450 / 451: don't falsely discard
          finish({ valid: true, code, note: `SMTP response ${code} - fallback to active MX` });
        }
      }
    });
  });
}

/**
 * Checks whether an email domain has active MX (Mail Exchange) DNS records,
 * with optional deep zero-send SMTP mailbox verification.
 */
export async function verifyEmailMx(
  email: string,
  deepSmtp = false
): Promise<{
  valid: boolean;
  mxRecords?: string[];
  reason?: string;
  smtpStatus?: string;
}> {
  if (!isValidEmailFormat(email)) {
    return { valid: false, reason: "invalid_format" };
  }

  if (isDisposableDomain(email)) {
    return { valid: false, reason: "disposable_domain" };
  }

  // Check dead / bounced blacklist
  try {
    const { isEmailBounced } = await import("./bounce-checker");
    if (await isEmailBounced(email)) {
      return { valid: false, reason: "previously_bounced_blacklist" };
    }
  } catch {}

  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) {
    return { valid: false, reason: "missing_domain" };
  }

  try {
    const dnsPromise = dns.promises.resolveMx(domain);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS resolution timed out")), 1500)
    );
    const records = await Promise.race([dnsPromise, timeoutPromise]);
    if (records && records.length > 0) {
      // Sort by priority
      records.sort((a, b) => a.priority - b.priority);
      const topMx = records[0].exchange;

      let smtpStatus = "MX Verified";
      if (deepSmtp && topMx) {
        const ping = await pingMailboxSmtp(email, topMx);
        if (!ping.valid) {
          return { valid: false, reason: ping.note || "smtp_mailbox_rejected" };
        }
        smtpStatus = ping.note || "SMTP Verified";
      }

      return {
        valid: true,
        mxRecords: records.map((r) => `${r.exchange} (pri:${r.priority})`),
        smtpStatus,
      };
    }
    return { valid: false, reason: "no_mx_records" };
  } catch (error: any) {
    if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
      return { valid: false, reason: "domain_not_found" };
    }
    // In case of timeout or strict network DNS errors, don't strictly discard valid formats
    console.warn(`[DNS MX Check] Warning checking MX for ${domain}:`, error.message);
    return { valid: true, reason: "dns_check_bypassed" };
  }
}

const INVALID_EMAIL_PREFIXES = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "abuse",
  "privacy",
  "security",
  "legal",
  "billing",
  "compliance",
  "dmca",
  "postmaster",
  "hostmaster",
  "webmaster",
  "mailer-daemon",
]);

const BLACKLISTED_EMAIL_DOMAINS = new Set([
  "example.com",
  "test.com",
  "sentry.io",
  "w3.org",
  "schema.org",
  "domain.com",
  "yourcompany.com",
  "company.com",
  "ycombinator.com",
  "algolia.com",
  "cloudflare.com",
  "dol.gov",
  "eeo.gov",
  "usa.gov",
  "gov.uk",
  "gov.in",
]);

/**
 * Extracts and cleans all valid email addresses found inside raw text or HTML.
 */
export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];

  // Match email pattern
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

  const unique = new Set<string>();
  for (const m of matches) {
    const cleaned = m.trim().toLowerCase().replace(/[<>"'()]/g, "");
    if (
      isValidEmailFormat(cleaned) &&
      !isDisposableDomain(cleaned) &&
      !cleaned.endsWith(".png") &&
      !cleaned.endsWith(".jpg") &&
      !cleaned.endsWith(".svg")
    ) {
      const [prefix, dom] = cleaned.split("@");
      if (prefix && INVALID_EMAIL_PREFIXES.has(prefix)) continue;
      if (dom && BLACKLISTED_EMAIL_DOMAINS.has(dom)) continue;
      unique.add(cleaned);
    }
  }

  return Array.from(unique);
}

