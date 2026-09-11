import tls from "tls";

export interface SmtpSendOptions {
  fromEmail: string;
  fromName?: string;
  appPassword: string; // 16-character Google App Password (spaces will be stripped)
  toEmail: string;
  subject: string;
  body: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentBase64?: string;
}

function sanitizeHeader(val: string): string {
  return (val || "").replace(/[\r\n]+/g, " ").trim();
}

function chunkBase64(base64Str: string, chunkSize = 76): string {
  const clean = base64Str.replace(/[\r\n]+/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize));
  }
  return chunks.join("\r\n");
}

function createRawMimeMessage(options: SmtpSendOptions): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeSubject = sanitizeHeader(options.subject);
  const fromHeader = options.fromName && options.fromEmail 
    ? `"${sanitizeHeader(options.fromName)}" <${options.fromEmail}>` 
    : options.fromEmail;

  const headers = [
    `From: ${fromHeader}`,
    `To: ${options.toEmail}`,
    `Subject: ${safeSubject}`,
    `MIME-Version: 1.0`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@fetchmail>`,
  ];

  if (options.attachmentBase64 && options.attachmentName) {
    const safeAttachmentName = sanitizeHeader(options.attachmentName);
    const mimeType = options.attachmentMimeType || "application/pdf";

    const parts = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
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
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      options.body,
    ];
    return parts.join("\r\n");
  }
}

/**
 * Sends an email directly through Google Gmail SMTP (smtp.gmail.com:465 SSL)
 * using the candidate's Email + 16-digit Google App Password.
 * Zero external dependencies, 100% native Node.js TLS.
 */
export async function sendGmailSmtp(
  options: SmtpSendOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return new Promise((resolve) => {
    const cleanPass = (options.appPassword || "").replace(/\s+/g, "");
    const cleanUser = (options.fromEmail || "").toLowerCase().trim();

    if (!cleanUser || !cleanPass) {
      return resolve({ success: false, error: "Missing Gmail username or App Password." });
    }

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
    socket.setTimeout(25000, () => {
      socket.destroy();
      resolve({ success: false, error: "Gmail SMTP connection timed out (25s)." });
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
          socket.write("QUIT\r\n");
          socket.end();
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
              sendCmd("EHLO fetchmail");
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
              sendCmd(`RCPT TO:<${options.toEmail.trim()}>`);
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
