/**
 * Simple in-memory rate limiter for API routes.
 * Uses sliding window counter per IP.
 * Not shared across serverless instances — good enough for basic protection.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60s to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowSeconds: 60 },       // 5 login attempts per minute
  register: { max: 3, windowSeconds: 60 },     // 3 registrations per minute
  bet: { max: 30, windowSeconds: 60 },         // 30 bets per minute
  webhook: { max: 60, windowSeconds: 60 },      // 60 webhook calls per minute
  default: { max: 60, windowSeconds: 60 },      // 60 requests per minute
};

/**
 * Check rate limit for a given IP + action.
 * Returns { allowed, remaining, retryAfterSeconds }
 */
export function checkRateLimit(
  ip: string,
  action: string = "default"
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const config = DEFAULTS[action] || DEFAULTS.default;
  const key = `${action}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true, remaining: config.max - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, retryAfterSeconds: 0 };
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
