import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// GET /api/affiliates - list all affiliates (admin) or get by code
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const id = req.nextUrl.searchParams.get("id");

  // Get single affiliate by code (public - for validating referral links)
  if (code) {
    const { data } = await supabase
      .from("affiliates")
      .select("id, code, name, status")
      .eq("code", code.toLowerCase())
      .eq("status", "active")
      .single();
    if (!data) return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });
    return NextResponse.json(data);
  }

  // Get single affiliate with full details
  if (id) {
    const { data: affiliate } = await supabase.from("affiliates").select("*").eq("id", id).single();
    if (!affiliate) return NextResponse.json({ error: "Afiliado não encontrado" }, { status: 404 });

    // Get referrals
    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("affiliate_id", id)
      .order("created_at", { ascending: false });

    // Get commissions
    const { data: commissions } = await supabase
      .from("affiliate_commissions")
      .select("*")
      .eq("affiliate_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ affiliate, referrals: referrals || [], commissions: commissions || [] });
  }

  // List all affiliates (admin)
  const { data, error } = await supabase
    .from("affiliates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/affiliates - create new affiliate
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, code, commission_percent, user_id, notes } = body;

  if (!name || !email || !code) {
    return NextResponse.json({ error: "Nome, email e código são obrigatórios" }, { status: 400 });
  }

  const normalizedCode = code.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (normalizedCode.length < 3) {
    return NextResponse.json({ error: "Código deve ter no mínimo 3 caracteres" }, { status: 400 });
  }

  // Check if code already exists
  const { data: existing } = await supabase.from("affiliates").select("id").eq("code", normalizedCode).single();
  if (existing) {
    return NextResponse.json({ error: "Este código já está em uso" }, { status: 409 });
  }

  const id = genId("aff");
  const { error } = await supabase.from("affiliates").insert({
    id,
    user_id: user_id || null,
    name,
    email: email.toLowerCase(),
    code: normalizedCode,
    commission_percent: commission_percent || 10,
    notes: notes || "",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, code: normalizedCode });
}

// PUT /api/affiliates - update affiliate
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("affiliates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/affiliates - delete affiliate
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });

  // Delete commissions, referrals, then affiliate
  await supabase.from("affiliate_commissions").delete().eq("affiliate_id", id);
  await supabase.from("referrals").delete().eq("affiliate_id", id);
  const { error } = await supabase.from("affiliates").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
