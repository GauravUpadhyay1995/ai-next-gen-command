import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExcelRow = {
  email: string;
  [key: string]: any;
};

type SendResult = {
  email: string;
  success: boolean;
  message: string;
  skipped?: boolean;
  reason?:
    | "invalid_email"
    | "duplicate_in_excel"
    | "already_sent"
    | "send_failed";
};

function replaceVariables(template: string, row: ExcelRow) {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const cleanKey = String(key).trim().toLowerCase();
    return row[cleanKey] ? String(row[cleanKey]) : "";
  });
}

function sanitizeHeader(value: string) {
  return String(value || "")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .trim();
}

function normalizeEmail(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[<>"']/g, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getMimeType(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (lower.endsWith(".doc")) {
    return "application/msword";
  }

  return "application/octet-stream";
}

function chunkBase64(base64: string) {
  return base64.match(/.{1,76}/g)?.join("\r\n") || base64;
}

function createRawEmail({
  to,
  subject,
  body,
  attachmentName,
  attachmentMimeType,
  attachmentBase64,
}: {
  to: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentMimeType: string;
  attachmentBase64: string;
}) {
  const boundary = `boundary_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const safeSubject = sanitizeHeader(subject);
  const safeAttachmentName = sanitizeHeader(attachmentName);

  const messageParts = [
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,

    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
    ``,

    `--${boundary}`,
    `Content-Type: ${attachmentMimeType}; name="${safeAttachmentName}"`,
    `Content-Disposition: attachment; filename="${safeAttachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    chunkBase64(attachmentBase64),
    ``,

    `--${boundary}--`,
  ];

  return base64UrlEncode(messageParts.join("\r\n"));
}

async function getAlreadySentEmails(gmail: any, emails: string[]): Promise<Set<string>> {
  const alreadySent = new Set<string>();
  if (emails.length === 0) return alreadySent;

  const BATCH_SIZE = 25;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const toQuery = batch.map(email => `to:${email}`).join(" OR ");
    const q = `in:sent (${toQuery})`;

    try {
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: 100,
      });

      const messages = listResponse.data.messages || [];
      if (messages.length > 0) {
        const detailsPromises = messages.map(async (message: any) => {
          try {
            const msg = await gmail.users.messages.get({
              userId: "me",
              id: message.id!,
              format: "metadata",
              metadataHeaders: ["To"],
            });
            const headers = msg.data.payload?.headers || [];
            const toHeader = headers.find((h: any) => h.name?.toLowerCase() === "to")?.value || "";
            const matches = toHeader.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            matches.forEach((email: string) => {
              alreadySent.add(email.trim().toLowerCase());
            });
          } catch (err) {
            console.error(`Error fetching message metadata for ${message.id}:`, err);
          }
        });
        await Promise.all(detailsPromises);
      }
    } catch (err) {
      console.error(`Error querying batch of sent emails:`, err);
    }
  }

  return alreadySent;
}

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
    const accessToken = req.cookies.get("gmail_access_token")?.value;

    if (!refreshToken && !accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Gmail not connected. Please connect Gmail first.",
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();

    const rowsRaw = formData.get("rows");
    const subjectTemplate = String(formData.get("subject") || "");
    const bodyTemplate = String(formData.get("body") || "");
    const resume = formData.get("resume") as File | null;

    if (!rowsRaw) {
      return NextResponse.json(
        {
          success: false,
          message: "Rows data missing.",
        },
        { status: 400 }
      );
    }

    if (!resume) {
      return NextResponse.json(
        {
          success: false,
          message: "Resume file missing.",
        },
        { status: 400 }
      );
    }

    if (!subjectTemplate.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Subject is required.",
        },
        { status: 400 }
      );
    }

    if (!bodyTemplate.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Email body is required.",
        },
        { status: 400 }
      );
    }

    const rows: ExcelRow[] = JSON.parse(String(rowsRaw));

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No emails found in Excel.",
        },
        { status: 400 }
      );
    }

    const resumeBuffer = Buffer.from(await resume.arrayBuffer());
    const attachmentBase64 = resumeBuffer.toString("base64");
    const attachmentName = resume.name || "resume.pdf";
    const attachmentMimeType = getMimeType(attachmentName);

    const oauth2Client = createOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const results: SendResult[] = [];
    const seenEmails = new Set<string>();

    // Gather all valid unique emails to check in batches
    const emailsToCheck: string[] = [];
    for (const row of rows) {
      const to = normalizeEmail(row.email);
      if (to && isValidEmail(to)) {
        emailsToCheck.push(to);
      }
    }
    const uniqueEmailsToCheck = Array.from(new Set(emailsToCheck));
    const alreadySentSet = await getAlreadySentEmails(gmail, uniqueEmailsToCheck);

    for (const row of rows) {
      const to = normalizeEmail(row.email);

      if (!to || !isValidEmail(to)) {
        results.push({
          email: to || "-",
          success: false,
          skipped: true,
          reason: "invalid_email",
          message: "Skipped: Invalid email",
        });
        continue;
      }

      if (seenEmails.has(to)) {
        results.push({
          email: to,
          success: false,
          skipped: true,
          reason: "duplicate_in_excel",
          message: "Skipped: Duplicate email in Excel",
        });
        continue;
      }

      seenEmails.add(to);

      try {
        const isAlreadySent = alreadySentSet.has(to);

        if (isAlreadySent) {
          results.push({
            email: to,
            success: false,
            skipped: true,
            reason: "already_sent",
            message: "Skipped: Already sent before",
          });
          continue;
        }

        const normalizedRow = {
          ...row,
          email: to,
        };

        const finalSubject = replaceVariables(subjectTemplate, normalizedRow);
        const finalBody = replaceVariables(bodyTemplate, normalizedRow);

        const raw = createRawEmail({
          to,
          subject: finalSubject,
          body: finalBody,
          attachmentName,
          attachmentMimeType,
          attachmentBase64,
        });

        await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw,
          },
        });

        results.push({
          email: to,
          success: true,
          skipped: false,
          message: "Sent",
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err: any) {
        const message =
          err?.response?.data?.error?.message ||
          err?.message ||
          "Failed";

        results.push({
          email: to,
          success: false,
          skipped: false,
          reason: "send_failed",
          message,
        });
      }
    }

    const sentCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter(
      (r) => !r.success && !r.skipped
    ).length;
    const alreadySentCount = results.filter(
      (r) => r.reason === "already_sent"
    ).length;
    const duplicateCount = results.filter(
      (r) => r.reason === "duplicate_in_excel"
    ).length;
    const invalidEmailCount = results.filter(
      (r) => r.reason === "invalid_email"
    ).length;

    return NextResponse.json({
      success: true,
      total: rows.length,
      uniqueChecked: seenEmails.size,
      sentCount,
      skippedCount,
      failedCount,
      alreadySentCount,
      duplicateCount,
      invalidEmailCount,
      results,
    });
  } catch (error: any) {
    console.error("Bulk send error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to send bulk emails",
      },
      { status: 500 }
    );
  }
}