import dns from "dns";

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
 * Checks whether an email domain has active MX (Mail Exchange) DNS records.
 * Uses native Node.js DNS promises (zero external API cost).
 */
export async function verifyEmailMx(email: string): Promise<{
  valid: boolean;
  mxRecords?: string[];
  reason?: string;
}> {
  if (!isValidEmailFormat(email)) {
    return { valid: false, reason: "invalid_format" };
  }

  if (isDisposableDomain(email)) {
    return { valid: false, reason: "disposable_domain" };
  }

  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) {
    return { valid: false, reason: "missing_domain" };
  }

  try {
    const records = await dns.promises.resolveMx(domain);
    if (records && records.length > 0) {
      // Sort by priority
      records.sort((a, b) => a.priority - b.priority);
      return {
        valid: true,
        mxRecords: records.map((r) => `${r.exchange} (pri:${r.priority})`),
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
      unique.add(cleaned);
    }
  }

  return Array.from(unique);
}
