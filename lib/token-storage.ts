import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "./crypto";
import { saveOwnerToken, getOwnerToken } from "./db";

const TOKEN_FILE_PATH = path.join(process.cwd(), "owner-token.json");

export async function storeOwnerRefreshToken(email: string, refreshToken: string) {
  const encrypted = encrypt(refreshToken);

  // 1. Save to MongoDB if URI is available
  if (process.env.MONGODB_URI) {
    try {
      await saveOwnerToken(email, encrypted);
      console.log("Successfully saved owner refresh token to MongoDB");
    } catch (e) {
      console.error("Error saving owner token to DB:", e);
    }
  }

  // 2. Save to local file as fallback/backup
  try {
    const data = {
      email: email.toLowerCase(),
      encryptedRefreshToken: encrypted,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
    console.log("Successfully saved owner refresh token to local file:", TOKEN_FILE_PATH);
  } catch (e) {
    console.error("Error saving owner token to local file:", e);
  }
}

export async function loadOwnerToken(): Promise<{ email: string; refreshToken: string } | null> {
  // 1. comment Check if configured in environment variables (either encrypted or plaintext)
  if (process.env.OWNER_REFRESH_TOKEN && process.env.OWNER_EMAIL) {
    const token = process.env.OWNER_REFRESH_TOKEN;
    const email = process.env.OWNER_EMAIL.toLowerCase();

    // Try decrypting. If it fails, fallback to plaintext
    try {
      const decrypted = decrypt(token);
      if (decrypted) return { email, refreshToken: decrypted };
    } catch {
      // It's plaintext in the env variable, which is fine
      return { email, refreshToken: token };
    }
  }

  // 2. Load from MongoDB
  if (process.env.MONGODB_URI) {
    try {
      const dbToken = await getOwnerToken();
      if (dbToken && dbToken.encryptedRefreshToken) {
        const decrypted = decrypt(dbToken.encryptedRefreshToken);
        if (decrypted) {
          return { email: dbToken.email, refreshToken: decrypted };
        }
      }
    } catch (e) {
      console.error("Error loading owner token from DB:", e);
    }
  }

  // 3. Load from local file fallback
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const content = fs.readFileSync(TOKEN_FILE_PATH, "utf8");
      const data = JSON.parse(content);
      if (data && data.encryptedRefreshToken && data.email) {
        const decrypted = decrypt(data.encryptedRefreshToken);
        if (decrypted) {
          return { email: data.email, refreshToken: decrypted };
        }
      }
    }
  } catch (e) {
    console.error("Error loading owner token from local file:", e);
  }

  return null;
}
