import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel free plan: 10s timeout per function call.
// Strategy: client sends small batches (8 rows each), server sends ALL 8 in PARALLEL.
// 8 parallel Gmail sends ≈ 2-3s per call → well under 10s limit.
// 200 emails ÷ 8 = 25 batches × ~3s ≈ ~1 min 15s total.

type ExcelRow = {
  email: string;
  [key: string]: any;
};

type SendResult = {
  email: string;
  success: boolean;
  message: string;
  skipped?: boolean;
  reason?: "invalid_email" | "duplicate_in_excel" | "send_failed";
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

    // Client sends only the current batch's rows (sliced before upload).
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

    // --- Step 1: Pre-process rows — validate & deduplicate within this batch ---
    // Do this synchronously BEFORE launching parallel sends.
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

    // --- Step 2: Send all valid emails in PARALLEL (the key speed optimization) ---
    const results: SendResult[] = await Promise.all(
      jobs.map(async (job): Promise<SendResult> => {
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
    const duplicateCount = results.filter((r) => r.reason === "duplicate_in_excel").length;
    const invalidEmailCount = results.filter((r) => r.reason === "invalid_email").length;

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      failedCount,
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