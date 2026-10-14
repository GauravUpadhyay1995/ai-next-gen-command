import tls from "tls";
import { verifyEmailMx, isValidEmailFormat } from "./email-verifier";

export interface SmtpSendOptions {
  fromEmail: string;
  fromName?: string;
  appPassword?: string; // 16-character Google App Password (spaces will be stripped)
  toEmail: string;
  subject: string;
  body: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
  skipMxCheck?: boolean;
}

export function sanitizeHeader(val: string): string {
  return (val || "").replace(/[\r\n\t]+/g, " ").trim();
}

export function chunkBase64(base64Str: string, chunkSize = 76): string {
  const clean = base64Str.replace(/[\r\n]+/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize));
  }
  return chunks.join("\r\n");
}

export function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Extracts sender domain for valid RFC-5322 Message-ID and EHLO handshake.
 */
export function getDomainFromEmail(email: string): string {
  try {
    const parts = (email || "").trim().split("@");
    if (parts.length === 2 && parts[1].includes(".")) {
      return parts[1].toLowerCase().trim();
    }
  } catch {
    // fallback
  }
  return "gmail.com";
}

/**
 * Creates RFC-5322 compliant raw MIME message string.
 */
export function createRawMimeMessage(options: SmtpSendOptions): string {
  const boundary = `====_fetchmail_${Date.now()}_${Math.random().toString(36).slice(2, 9)}====`;
  const safeSubject = sanitizeHeader(options.subject);
  const senderDomain = getDomainFromEmail(options.fromEmail);
  const fromHeader = options.fromName && options.fromEmail 
    ? `"${sanitizeHeader(options.fromName)}" <${options.fromEmail.trim()}>` 
    : options.fromEmail.trim();

  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${senderDomain}>`;
  const dateHeader = new Date().toUTCString();

  const standardHeaders = [
    `From: ${fromHeader}`,
    `To: ${options.toEmail.trim()}`,
    `Reply-To: ${fromHeader}`,
    `Subject: ${safeSubject}`,
    `Date: ${dateHeader}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `X-Mailer: FetchMail Outreach Engine/2.0`,
    `X-Priority: 3`,
  ];

  if (options.attachmentBase64 && options.attachmentName) {
    const safeAttachmentName = sanitizeHeader(options.attachmentName);
    const mimeType = options.attachmentMimeType || "application/pdf";

    const parts = [
      ...standardHeaders,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      options.body,
      ``,
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${safeAttachmentName}"`,
      `Content-Disposition: attachment; filename="${safeAttachmentName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      chunkBase64(options.attachmentBase64),
      ``,
      `--${boundary}--`,
    ];
    return parts.join("\r\n");
  } else {
    const parts = [
      ...standardHeaders,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      options.body,
    ];
    return parts.join("\r\n");
  }
}

/**
 * Creates Base64URL-encoded raw MIME string for Gmail OAuth users.messages.send API.
 */
export function createRawMimeEmailBase64(options: SmtpSendOptions): string {
  const mimeText = createRawMimeMessage(options);
  return base64UrlEncode(mimeText);
}

/**
 * Sends an email directly through Google Gmail SMTP (smtp.gmail.com:465 SSL)
 * using the candidate's Email + 16-digit Google App Password.
 * Zero external dependencies, 100% native Node.js TLS with RFC-5322 compliance.
 */
export async function sendGmailSmtp(
  options: SmtpSendOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 1. Format & Input Sanity Check
  const cleanUser = (options.fromEmail || "").toLowerCase().trim();
  const cleanPass = (options.appPassword || "").replace(/\s+/g, "");
  const targetEmail = (options.toEmail || "").toLowerCase().trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: "Missing Gmail username or 16-character App Password." };
  }

  if (!isValidEmailFormat(targetEmail)) {
    return { success: false, error: `Invalid recipient email format: "${targetEmail}"` };
  }

  // 2. Pre-flight MX Verification (Bounce Protection)
  if (!options.skipMxCheck) {
    try {
      const mxResult = await verifyEmailMx(targetEmail);
      if (!mxResult.valid) {
        return {
          success: false,
          error: `Delivery blocked: Recipient domain has no active MX records (${mxResult.reason || "unreachable domain"}).`,
        };
      }
    } catch {
      // If DNS resolution fails due to network sandbox, continue gracefully
    }
  }

  // 3. RFC-Compliant SMTP TLS Session
  return new Promise((resolve) => {
    const senderDomain = getDomainFromEmail(cleanUser);
    const socket = tls.connect({
      host: "smtp.gmail.com",
      port: 465,
      rejectUnauthorized: true,
    });

    let stage = 0;
    let buffer = "";

    const sendCmd = (cmd: string) => {
      socket.write(cmd + "\r\n");
    };

    socket.setEncoding("utf-8");
    socket.setTimeout(18000, () => {
      socket.destroy();
      resolve({ success: false, error: "Gmail SMTP connection timed out (18s inactivity)." });
    });

    socket.on("data", (data: string) => {
      buffer += data;
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        const code = parseInt(line.slice(0, 3), 10);

        // Check for SMTP errors (4xx or 5xx)
        if (code >= 400) {
          try {
            socket.write("QUIT\r\n");
            socket.end();
          } catch {
            // socket closed
          }
          return resolve({
            success: false,
            error: `Gmail SMTP Error (${code}): ${line.slice(4) || "Authentication or delivery failure"}`,
          });
        }

        // Multi-line SMTP responses (e.g. 250-...)
        if (line.charAt(3) === "-") continue;

        switch (stage) {
          case 0: // Connected, waiting for 220 greeting
            if (code === 220) {
              stage = 1;
              sendCmd(`EHLO ${senderDomain}`);
            }
            break;

          case 1: // After EHLO, start AUTH LOGIN
            if (code === 250) {
              stage = 2;
              sendCmd("AUTH LOGIN");
            }
            break;

          case 2: // Waiting for 334 (Username prompt)
            if (code === 334) {
              stage = 3;
              sendCmd(Buffer.from(cleanUser).toString("base64"));
            }
            break;

          case 3: // Waiting for 334 (Password prompt)
            if (code === 334) {
              stage = 4;
              sendCmd(Buffer.from(cleanPass).toString("base64"));
            }
            break;

          case 4: // Authenticated (235)
            if (code === 235) {
              stage = 5;
              sendCmd(`MAIL FROM:<${cleanUser}>`);
            }
            break;

          case 5: // Sender OK (250)
            if (code === 250) {
              stage = 6;
              sendCmd(`RCPT TO:<${targetEmail}>`);
            }
            break;

          case 6: // Recipient OK (250)
            if (code === 250) {
              stage = 7;
              sendCmd("DATA");
            }
            break;

          case 7: // Ready for DATA (354)
            if (code === 354) {
              stage = 8;
              const mimeMessage = createRawMimeMessage(options);
              // Ensure clean trailing dot on its own line
              socket.write(mimeMessage + "\r\n.\r\n");
            }
            break;

          case 8: // Message accepted (250)
            if (code === 250) {
              stage = 9;
              sendCmd("QUIT");
              socket.end();
              return resolve({ success: true, messageId: line });
            }
            break;
        }
      }
    });

    socket.on("error", (err: Error) => {
      resolve({ success: false, error: `SMTP Socket Error: ${err.message}` });
    });

    socket.on("end", () => {
      if (stage < 8) {
        resolve({ success: false, error: "SMTP Connection closed prematurely before email was sent." });
      }
    });
  });
}

