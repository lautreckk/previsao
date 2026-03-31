export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function checkAdmin(request: NextRequest): boolean {
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  const secret = request.headers.get("x-admin-secret");
  const adminSecret = process.env.ADMIN_SECRET || "admin";
  return auth === adminSecret || secret === adminSecret;
}

function generateApiKey(): string {
  const ts = Date.now().toString(36);
  const rand = Array.from({ length: 8 }, () =>
    Math.random().toString(36).charAt(2)
  ).join("");
  return `wfp_${ts}_${rand}`;
}

/**
 * GET /api/admin/api-keys
 * List all API keys with stats
 */
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = sb();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate stats
  const total = data?.length || 0;
  const active = data?.filter((k) => k.is_active).length || 0;
  const totalRequests = data?.reduce((sum, k) => sum + (k.request_count || 0), 0) || 0;

  return NextResponse.json({
    keys: data || [],
    stats: { total, active, inactive: total - active, total_requests: totalRequests },
  });
}

/**
 * POST /api/admin/api-keys
 * Create a new API key
 *
 * Body: { name, owner_id?, permissions?, rate_limit_per_minute? }
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name: string;
    owner_id?: string;
    permissions?: string[];
    rate_limit_per_minute?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const apiKey = generateApiKey();

  const supabase = sb();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      key: apiKey,
      name: body.name,
      owner_id: body.owner_id || body.name.toLowerCase().replace(/\s+/g, "_"),
      permissions: body.permissions || ["read"],
      rate_limit_per_minute: body.rate_limit_per_minute || 60,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    key: data,
    raw_key: apiKey, // Show only once!
    message: "API key created. Save the raw_key — it won't be shown again in full.",
  });
}

/**
 * PATCH /api/admin/api-keys
 * Update an API key
 *
 * Body: { id, is_active?, rate_limit_per_minute?, name?, permissions? }
 */
export async function PATCH(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id: string;
    is_active?: boolean;
    rate_limit_per_minute?: number;
    name?: string;
    permissions?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.rate_limit_per_minute !== undefined) update.rate_limit_per_minute = body.rate_limit_per_minute;
  if (body.name !== undefined) update.name = body.name;
  if (body.permissions !== undefined) update.permissions = body.permissions;

  const supabase = sb();
  const { data, error } = await supabase
    .from("api_keys")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ key: data });
}

/**
 * DELETE /api/admin/api-keys
 * Delete an API key
 *
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = sb();
  const { error } = await supabase.from("api_keys").delete().eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, id: body.id });
}
