import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Singleton service-role client for server-side API routes
// This bypasses RLS — use only in API routes, never expose to client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ── Auth helpers for API routes ──

/** Validate a signed admin token (from cookie or header) */
function isValidAdminToken(token: string): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_SECRET || "";
  // Accept raw ADMIN_SECRET for backwards compat (internal/cron calls)
  if (token === secret) return true;
  // Validate signed token: admin:timestamp:hmac
  const parts = token.split(":");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const [role, ts, providedHmac] = parts;
  const tokenAge = Date.now() - parseInt(ts, 10);
  if (isNaN(tokenAge) || tokenAge > 8 * 60 * 60 * 1000 || tokenAge < 0) return false;
  const payload = `${role}:${ts}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

/** Check admin auth from HttpOnly cookie, Authorization header, or x-admin-secret header */
export function checkAdminSecret(request: NextRequest): boolean {
  // 1. HttpOnly cookie (XSS-immune, set by /api/admin/login)
  const cookie = request.cookies.get("admin_session")?.value || "";
  if (isValidAdminToken(cookie)) return true;
  // 2. Authorization header
  const auth = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (isValidAdminToken(auth)) return true;
  // 3. x-admin-secret header
  const header = request.headers.get("x-admin-secret") || "";
  if (isValidAdminToken(header)) return true;
  return false;
}

/** Check ADMIN_SECRET from request body `secret` field */
export function checkBodySecret(secret: string | undefined): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  return secret === adminSecret;
}

/** Check CRON_SECRET from Authorization Bearer header */
export function checkCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  return auth === cronSecret;
}

/** Check WORKER_SECRET from request body `secret` field */
export function checkWorkerSecret(secret: string | undefined): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerSecret || !secret) return false;
  return secret === workerSecret;
}

/** Standard 401 response */
export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
