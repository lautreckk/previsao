export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

// GET: List active camera markets (public)
export async function GET() {
  const { data, error } = await supabase
    .from("camera_markets")
    .select("*")
    .in("status", ["waiting", "open"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  return NextResponse.json({ markets: data || [] });
}

// POST: Create new camera market (admin only)
export async function POST(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { stream_url, stream_type, city, title, round_duration_seconds, thumbnail_url } = body;

    if (!stream_url || !title) {
      return NextResponse.json({ error: "stream_url and title required" }, { status: 400 });
    }

    const id = `cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase.from("camera_markets").insert({
      id,
      stream_url,
      stream_type: stream_type || "youtube",
      city: city || "",
      title,
      status: "waiting",
      current_count: 0,
      round_duration_seconds: round_duration_seconds || 300,
      thumbnail_url: thumbnail_url || "",
    }).select().single();

    if (error) return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    return NextResponse.json({ market: data });
  } catch (error) {
    console.error("[camera/markets] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}