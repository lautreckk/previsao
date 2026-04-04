import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// POST /api/affiliates/track
// Actions: "register" (new user signed up via ref link), "deposit" (referred user deposited)
// Called from client-side during registration/deposit — no admin auth needed
// Validates affiliate code exists before processing
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, code, user_id, user_name, user_email, amount } = body;

  if (!action || !code) {
    return NextResponse.json({ error: "action e code são obrigatórios" }, { status: 400 });
  }

  // Find affiliate by code
  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("*")
    .eq("code", code.toLowerCase())
    .eq("status", "active")
    .single();

  if (!affiliate) {
    return NextResponse.json({ error: "Afiliado não encontrado ou inativo" }, { status: 404 });
  }

  // ── REGISTER: new user signed up via referral link ──
  if (action === "register") {
    if (!user_id) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });

    // Check if referral already exists for this user
    const { data: existingRef } = await supabase
      .from("referrals")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (existingRef) {
      return NextResponse.json({ message: "Referral já registrado" });
    }

    // Create referral record
    const refId = genId("ref");
    await supabase.from("referrals").insert({
      id: refId,
      affiliate_id: affiliate.id,
      affiliate_code: code.toLowerCase(),
      user_id,
      user_name: user_name || "",
      user_email: user_email || "",
      status: "registered",
    });

    // Update affiliate stats
    await supabase.from("affiliates").update({
      total_referrals: (affiliate.total_referrals || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", affiliate.id);

    // Mark user as referred
    await supabase.from("users").update({
      referred_by: code.toLowerCase(),
    }).eq("id", user_id);

    return NextResponse.json({ success: true, referral_id: refId });
  }

  // ── DEPOSIT: referred user made a deposit ──
  if (action === "deposit") {
    if (!user_id || !amount) {
      return NextResponse.json({ error: "user_id e amount obrigatórios" }, { status: 400 });
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return NextResponse.json({ error: "amount inválido" }, { status: 400 });
    }

    // Find referral for this user
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .eq("user_id", user_id)
      .single();

    if (!referral) {
      return NextResponse.json({ error: "Referral não encontrado para este usuário" }, { status: 404 });
    }

    // Calculate commission
    const commissionPercent = affiliate.commission_percent || 10;
    const commissionAmount = Math.round(depositAmount * commissionPercent) / 100;

    // Create commission record
    const commId = genId("comm");
    await supabase.from("affiliate_commissions").insert({
      id: commId,
      affiliate_id: affiliate.id,
      referral_id: referral.id,
      user_id,
      type: "deposit",
      base_amount: depositAmount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      description: `Comissão sobre depósito de R$ ${depositAmount.toFixed(2)} por ${user_email || user_id}`,
    });

    // Update referral stats
    const isFirstDeposit = !referral.first_deposit_at;
    const updateReferral: Record<string, unknown> = {
      total_deposits: (Number(referral.total_deposits) || 0) + depositAmount,
      commission_generated: (Number(referral.commission_generated) || 0) + commissionAmount,
      status: "deposited",
    };
    if (isFirstDeposit) {
      updateReferral.first_deposit_amount = depositAmount;
      updateReferral.first_deposit_at = new Date().toISOString();
    }
    await supabase.from("referrals").update(updateReferral).eq("id", referral.id);

    // Update affiliate stats
    await supabase.from("affiliates").update({
      total_deposits: (Number(affiliate.total_deposits) || 0) + depositAmount,
      total_commission: (Number(affiliate.total_commission) || 0) + commissionAmount,
      balance: (Number(affiliate.balance) || 0) + commissionAmount,
      updated_at: new Date().toISOString(),
    }).eq("id", affiliate.id);

    return NextResponse.json({ success: true, commission: commissionAmount });
  }

  return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 });
}
