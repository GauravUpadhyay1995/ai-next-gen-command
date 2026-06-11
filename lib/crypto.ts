import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-secret-key-please-change";
const IV_LENGTH = 16; // For AES, this is always 16

// Generate a 32-byte key from the ENCRYPTION_KEY
function getKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  if (!text) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  if (!text) return "";
  const textParts = text.split(":");
  const ivPart = textParts.shift();
  if (!ivPart) return "";
  const iv = Buffer.from(ivPart, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
