import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Singleton service-role client for server-side API routes
// This bypasses RLS — use only in API routes, never expose to client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ── Auth helpers for API routes ──

/** Check ADMIN_SECRET from Authorization header or x-admin-secret header */
export function checkAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  const header = request.headers.get("x-admin-secret");
  return auth === adminSecret || header === adminSecret;
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
