export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase, checkAdminSecret } from "@/lib/supabase-server";

// GET: List markets (public)
export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const category = request.nextUrl.searchParams.get("category");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  let query = supabase
    .from("prediction_markets")
    .select("*")
    .order("close_at", { ascending: true })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  } else {
    // Default: show active markets
    query = query.in("status", ["open", "frozen", "closed", "awaiting_resolution"]);
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  // Convert DB timestamps to milliseconds for frontend compatibility
  const markets = (data || []).map(dbToMarket);

  return NextResponse.json({ markets });
}

// POST: Create market (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market, secret } = body;

    // Simple auth check
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const slug = market.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);

    const row = {
      id,
      title: market.title,
      slug,
      short_description: market.short_description || "",
      full_description: market.full_description || "",
      category: market.category || "custom",
      subcategory: market.subcategory || "",
      tags: market.tags || [],
      banner_url: market.banner_url || "",
      is_featured: market.is_featured || false,
      visibility: "public",
      market_type: market.market_type || "binary",
      outcome_type: market.outcome_type || "yes_no",
      outcomes: market.outcomes || [],
      resolution_type: market.resolution_type || "manual",
      source_type: market.source_type || "manual",
      source_config: market.source_config || {},
      resolution_rule: market.resolution_rule || {},
      status: market.status || "open",
      close_at: market.close_at ? new Date(market.close_at).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      open_at: new Date().toISOString(),
      house_fee_percent: market.house_fee_percent ?? 0.05,
      min_bet: market.min_bet ?? 1,
      max_bet: market.max_bet ?? 10000,
      max_payout: market.max_payout ?? 100000,
      max_liability: market.max_liability ?? 500000,
      created_by: market.created_by || "admin",
      ai_generated: market.ai_generated || false,
      ai_prompt: market.ai_prompt || null,
      stream_url: market.stream_url || null,
      stream_type: market.stream_type || null,
    };

    const { data, error } = await supabase
      .from("prediction_markets")
      .insert(row)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    return NextResponse.json({ market: dbToMarket(data) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH: Update market (admin) - also handles cancel + refund
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates, secret } = body;

    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If cancelling, refund all bets
    if (updates.status === "cancelled") {
      await refundMarketBets(id);
    }

    const { data, error } = await supabase
      .from("prediction_markets")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    return NextResponse.json({ market: dbToMarket(data) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE: Remove market (admin — auth via header, not query param)
export async function DELETE(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Refund bets before deleting
  await refundMarketBets(id);

  const { error } = await supabase
    .from("prediction_markets")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ---- Helpers ----

async function refundMarketBets(marketId: string) {
  // Get all pending bets for this market
  const { data: bets } = await supabase
    .from("prediction_bets")
    .select("id, user_id, amount")
    .eq("market_id", marketId)
    .eq("status", "pending");

  if (!bets || bets.length === 0) return;

  // Refund each user
  for (const bet of bets) {
    // Update user balance
    const { data: userData } = await supabase
      .from("users")
      .select("balance")
      .eq("id", bet.user_id)
      .single();

    if (userData) {
      await supabase
        .from("users")
        .update({ balance: Number(userData.balance) + Number(bet.amount) })
        .eq("id", bet.user_id);
    }

    // Mark bet as refunded
    await supabase
      .from("prediction_bets")
      .update({ status: "refunded" })
      .eq("id", bet.id);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToMarket(row: any) {
  return {
    ...row,
    created_at: new Date(row.created_at).getTime(),
    open_at: new Date(row.open_at).getTime(),
    freeze_at: row.freeze_at ? new Date(row.freeze_at).getTime() : 0,
    close_at: new Date(row.close_at).getTime(),
    resolve_at: row.resolve_at ? new Date(row.resolve_at).getTime() : 0,
    resolved_at: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
    pool_total: Number(row.pool_total) || 0,
    distributable_pool: Number(row.distributable_pool) || 0,
    house_fee_percent: Number(row.house_fee_percent) || 0.05,
    min_bet: Number(row.min_bet) || 1,
    max_bet: Number(row.max_bet) || 10000,
    max_payout: Number(row.max_payout) || 100000,
    max_liability: Number(row.max_liability) || 500000,
    volume: Number(row.pool_total) || 0,
    tags: row.tags || [],
    outcomes: row.outcomes || [],
    source_config: row.source_config || { source_name: "", requires_manual_confirmation: false, requires_evidence_upload: false },
    resolution_rule: row.resolution_rule || { expression: "", variables: [], outcome_map: {}, description: "" },
    language: row.language || "pt-BR",
    country: row.country || "BR",
  };
}
