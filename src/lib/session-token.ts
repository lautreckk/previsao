import crypto from "crypto";

const SESSION_SECRET = process.env.ADMIN_SECRET || process.env.WORKER_SECRET || "fallback-secret";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a signed session token for a user.
 * Format: userId:timestamp:hmac
 */
export function generateSessionToken(userId: string): string {
  const ts = Date.now().toString();
  const payload = `${userId}:${ts}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

/**
 * Validate a session token and extract the userId.
 * Returns null if invalid or expired.
 */
export function validateSessionToken(token: string): string | null {
  if (!token) return null;

  const parts = token.split(":");
  if (parts.length !== 3) return null;

  const [userId, ts, providedHmac] = parts;
  if (!userId || !ts || !providedHmac) return null;

  // Check expiration
  const tokenAge = Date.now() - parseInt(ts, 10);
  if (isNaN(tokenAge) || tokenAge > TOKEN_TTL_MS || tokenAge < 0) return null;

  // Verify HMAC
  const payload = `${userId}:${ts}`;
  const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
    return valid ? userId : null;
  } catch {
    return false as unknown as null;
  }
}

/**
 * Extract and validate userId from request headers.
 * Looks for x-session-token header.
 * Returns null if no valid session.
 */
export function getUserIdFromRequest(request: Request): string | null {
  const token = request.headers.get("x-session-token") || "";
  return validateSessionToken(token);
}
