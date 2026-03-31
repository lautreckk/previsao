// ============================================================
// WINIFY DATA PROVIDER API - Authentication Middleware
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface ApiKeyData {
  id: string;
  key: string;
  name: string;
  owner_id: string;
  permissions: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Validate API key from x-api-key header or Authorization bearer.
 * Falls back to CRON_SECRET / ADMIN_SECRET for internal calls.
 */
export async function validateApiKey(request: NextRequest): Promise<{
  valid: boolean;
  key?: ApiKeyData;
  error?: string;
}> {
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!apiKey) {
    return { valid: false, error: "Missing API key. Send via x-api-key header." };
  }

  // Internal keys (cron, admin, worker)
  const internalKeys = [
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
    process.env.WORKER_SECRET,
  ].filter(Boolean);

  if (internalKeys.includes(apiKey)) {
    return {
      valid: true,
      key: {
        id: "internal",
        key: "internal",
        name: "Internal Service",
        owner_id: "system",
        permissions: ["*"],
        rate_limit_per_minute: 9999,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };
  }

  // Check DB for client API keys
  try {
    const sb = getAdminClient();
    const { data, error } = await sb
      .from("api_keys")
      .select("*")
      .eq("key", apiKey)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return { valid: false, error: "Invalid or inactive API key." };
    }

    // Update last_used_at
    sb.from("api_keys")
      .update({ last_used_at: new Date().toISOString(), request_count: (data.request_count || 0) + 1 })
      .eq("id", data.id)
      .then(() => {});

    return { valid: true, key: data as ApiKeyData };
  } catch {
    // If api_keys table doesn't exist yet, allow internal keys only
    return { valid: false, error: "API key validation failed." };
  }
}

/**
 * Wrap a handler with API key authentication
 */
export function withAuth(
  handler: (req: NextRequest, apiKey: ApiKeyData) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const { valid, key, error } = await validateApiKey(req);
    if (!valid || !key) {
      return NextResponse.json(
        { error: error || "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return handler(req, key);
  };
}

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 400, code?: string) {
  return NextResponse.json(
    { error: message, code: code || "BAD_REQUEST", timestamp: new Date().toISOString() },
    { status }
  );
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({
    data,
    meta: { ...meta, timestamp: new Date().toISOString() },
  });
}
