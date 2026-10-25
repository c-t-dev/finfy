import "server-only";
import { createHash } from "node:crypto";

/**
 * Have I Been Pwned range API (k-anonymity): only the first 5 hex characters
 * of the SHA-1 leave the server. If the service is slow or down, sign-up is
 * not blocked: the check fails open and logs it.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch (error) {
    console.warn("Breached-password check skipped:", (error as Error).message);
    return false;
  }
}
