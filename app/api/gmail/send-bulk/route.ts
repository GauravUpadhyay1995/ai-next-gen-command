import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel free plan: 10s timeout per function call.
// Each batch = 8 emails sent in PARALLEL + 1 targeted Gmail sent-check.
// Total per batch ≈ 2–4s → safe under 10s. 200 emails ≈ ~1.5 min total.

type ExcelRow = {
  email: string;
  [key: string]: any;
};

type SendResult = {
  email: string;
  success: boolean;
  message: string;
  skipped?: boolean;
  reason?: "invalid_email" | "duplicate_in_excel" | "already_sent" | "send_failed";
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
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
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
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

/**
 * Checks Gmail Sent folder for a small batch of emails (max 8).
 * Uses subject prefix to filter only app-sent emails — not personal history.
 * Fast because: targeted to-query + small maxResults + parallel metadata fetch.
 * Typical time: 300–500ms per batch call.
 */
async function checkAlreadySentViaGmail(
  gmail: any,
  emails: string[],
  subjectTemplate: string
): Promise<Set<string>> {
  const alreadySent = new Set<string>();
  if (emails.length === 0) return alreadySent;

  // Extract the static part of the subject (before any {{variable}}) as a filter.
  // This ensures we only match emails sent by THIS app, not unrelated personal emails.
  const subjectPrefix = subjectTemplate.split("{{")[0].trim();
  const subjectFilter = subjectPrefix ? ` subject:"${subjectPrefix}"` : "";

  // One query for all emails in this batch combined with OR
  const toQuery = emails.map((e) => `to:${e}`).join(" OR ");
  const q = `in:sent${subjectFilter} (${toQuery})`;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: emails.length * 3, // buffer: some addresses may have multiple threads
    });

    const messages: any[] = listRes.data.messages || [];
    if (messages.length === 0) return alreadySent;

    // Fetch To: headers for all matching messages in parallel
    await Promise.all(
      messages.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["To"],
          });
          const headers: any[] = detail.data.payload?.headers || [];
          const toHeader =
            headers.find((h) => h.name?.toLowerCase() === "to")?.value || "";
          const found =
            toHeader.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          found.forEach((addr: string) => {
            const normalized = addr.trim().toLowerCase();
            // Only mark as "already sent" if the address is actually in our batch
            if (emails.includes(normalized)) {
              alreadySent.add(normalized);
            }
          });
        } catch {
          // Ignore individual message fetch errors — don't block the batch
        }
      })
    );
  } catch (err) {
    // If the Gmail check fails entirely, log and proceed without skipping.
    // Better to send a duplicate than to silently drop an email.
    console.error("Gmail already-sent check failed:", err);
  }

  return alreadySent;
}

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("gmail_refresh_token")?.value;
    const accessToken = req.cookies.get("gmail_access_token")?.value;

    if (!refreshToken && !accessToken) {
      return NextResponse.json(
        { success: false, message: "Gmail not connected. Please connect Gmail first." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const rowsRaw = formData.get("rows");
    const subjectTemplate = String(formData.get("subject") || "");
    const bodyTemplate = String(formData.get("body") || "");
    const resume = formData.get("resume") as File | null;

    if (!rowsRaw)
      return NextResponse.json({ success: false, message: "Rows data missing." }, { status: 400 });
    if (!resume)
      return NextResponse.json({ success: false, message: "Resume file missing." }, { status: 400 });
    if (!subjectTemplate.trim())
      return NextResponse.json({ success: false, message: "Subject is required." }, { status: 400 });
    if (!bodyTemplate.trim())
      return NextResponse.json({ success: false, message: "Email body is required." }, { status: 400 });

    // Client sends only the current batch's rows (already sliced before upload).
    const rows: ExcelRow[] = JSON.parse(String(rowsRaw));
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ success: false, message: "No emails found in Excel." }, { status: 400 });

    const resumeBuffer = Buffer.from(await resume.arrayBuffer());
    const attachmentBase64 = resumeBuffer.toString("base64");
    const attachmentName = resume.name || "resume.pdf";
    const attachmentMimeType = getMimeType(attachmentName);

    const userOAuth = createOAuthClient();
    userOAuth.setCredentials({ refresh_token: refreshToken, access_token: accessToken });
    const sendGmail = google.gmail({ version: "v1", auth: userOAuth });

    // --- Step 1: Validate & deduplicate within this batch (synchronous) ---
    type Job =
      | { type: "skip"; result: SendResult }
      | { type: "send"; to: string; row: ExcelRow };

    const seenInBatch = new Set<string>();
    const jobs: Job[] = rows.map((row) => {
      const to = normalizeEmail(row.email);

      if (!to || !isValidEmail(to)) {
        return {
          type: "skip",
          result: {
            email: to || "-",
            success: false,
            skipped: true,
            reason: "invalid_email" as const,
            message: "Skipped: Invalid email",
          },
        };
      }

      if (seenInBatch.has(to)) {
        return {
          type: "skip",
          result: {
            email: to,
            success: false,
            skipped: true,
            reason: "duplicate_in_excel" as const,
            message: "Skipped: Duplicate email in Excel",
          },
        };
      }

      seenInBatch.add(to);
      return { type: "send", to, row };
    });

    // --- Step 2: Check Gmail Sent folder for this batch's emails only ---
    // Targeted query (max 8 emails) → fast: ~300–500ms
    const validEmails = jobs
      .filter((j): j is Extract<Job, { type: "send" }> => j.type === "send")
      .map((j) => j.to);

    const alreadySentSet = await checkAlreadySentViaGmail(
      sendGmail,
      validEmails,
      subjectTemplate
    );

    // Mark already-sent emails as skipped
    const finalJobs: Job[] = jobs.map((job) => {
      if (job.type === "skip") return job;
      if (alreadySentSet.has(job.to)) {
        return {
          type: "skip",
          result: {
            email: job.to,
            success: false,
            skipped: true,
            reason: "already_sent" as const,
            message: "Skipped: Already sent before",
          },
        };
      }
      return job;
    });

    // --- Step 3: Send remaining emails in PARALLEL ---
    const results: SendResult[] = await Promise.all(
      finalJobs.map(async (job): Promise<SendResult> => {
        if (job.type === "skip") return job.result;

        const { to, row } = job;
        const normalizedRow = { ...row, email: to };
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

        try {
          await sendGmail.users.messages.send({
            userId: "me",
            requestBody: { raw },
          });
          return { email: to, success: true, skipped: false, message: "Sent" };
        } catch (err: any) {
          const message =
            err?.response?.data?.error?.message || err?.message || "Failed";
          return {
            email: to,
            success: false,
            skipped: false,
            reason: "send_failed",
            message,
          };
        }
      })
    );

    const sentCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failedCount = results.filter((r) => !r.success && !r.skipped).length;
    const alreadySentCount = results.filter((r) => r.reason === "already_sent").length;
    const duplicateCount = results.filter((r) => r.reason === "duplicate_in_excel").length;
    const invalidEmailCount = results.filter((r) => r.reason === "invalid_email").length;

    return NextResponse.json({
      success: true,
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
      { success: false, message: error.message || "Failed to send bulk emails" },
      { status: 500 }
    );
  }
}