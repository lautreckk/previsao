export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// POST: Confirm a specific pending PIX deposit and credit user balance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pixId } = body;

    if (!pixId) {
      return NextResponse.json({ error: "pixId obrigatorio" }, { status: 400 });
    }

    // 1. Find the pix_transaction
    const { data: pix, error: pixErr } = await supabase
      .from("pix_transactions")
      .select("*")
      .eq("id", pixId)
      .maybeSingle();

    if (pixErr || !pix) {
      return NextResponse.json({ error: "Transacao PIX nao encontrada" }, { status: 404 });
    }

    if (pix.status === "paid") {
      return NextResponse.json({ message: "Ja confirmado", alreadyPaid: true });
    }

    const pixAmount = Number(pix.amount);

    // 2. Mark as paid
    await supabase
      .from("pix_transactions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", pixId);

    // 3. Find user by user_id or user_email
    let userId = pix.user_id;
    if (!userId && pix.user_email) {
      const { data: u } = await supabase
        .from("users")
        .select("id")
        .eq("email", pix.user_email.toLowerCase())
        .maybeSingle();
      if (u) {
        userId = u.id;
        await supabase.from("pix_transactions").update({ user_id: userId }).eq("id", pixId);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Usuario nao encontrado para este deposito", pixConfirmed: true }, { status: 404 });
    }

    // 4. Get current balance and credit
    const { data: user } = await supabase
      .from("users")
      .select("id, balance, name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado no banco" }, { status: 404 });
    }

    const newBalance = Number(user.balance) + pixAmount;

    await supabase
      .from("users")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", userId);

    // 5. Create ledger entry
    await supabase.from("ledger").insert({
      id: `ldg_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      type: "deposit",
      amount: pixAmount,
      balance_after: newBalance,
      reference_id: pix.transaction_id || pix.external_id || pixId,
      description: `Deposito PIX confirmado manualmente - R$ ${pixAmount.toFixed(2)}`,
    });

    return NextResponse.json({
      success: true,
      userId,
      userName: user.name,
      userEmail: user.email,
      amount: pixAmount,
      previousBalance: Number(user.balance),
      newBalance,
    });
  } catch (error: unknown) {
    console.error("Admin confirm-pix error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PUT: Bulk confirm all pending PIX transactions
export async function PUT() {
  try {
    const { data: pending } = await supabase
      .from("pix_transactions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!pending || pending.length === 0) {
      return NextResponse.json({ message: "Nenhum PIX pendente", confirmed: 0 });
    }

    // Get all users
    const { data: users } = await supabase.from("users").select("id, email, balance");
    const usersByEmail: Record<string, { id: string; balance: number }> = {};
    const usersById: Record<string, { id: string; balance: number }> = {};
    if (users) {
      users.forEach((u: { id: string; email: string; balance: number }) => {
        usersByEmail[u.email.toLowerCase()] = { id: u.id, balance: Number(u.balance) };
        usersById[u.id] = { id: u.id, balance: Number(u.balance) };
      });
    }

    const results: { pixId: string; email: string; amount: number; status: string }[] = [];

    for (const pix of pending) {
      const pixAmount = Number(pix.amount);
      let userRecord = pix.user_id ? usersById[pix.user_id] : null;
      if (!userRecord && pix.user_email) {
        userRecord = usersByEmail[pix.user_email.toLowerCase()];
      }

      if (!userRecord) {
        results.push({ pixId: pix.id, email: pix.user_email, amount: pixAmount, status: "usuario_nao_encontrado" });
        continue;
      }

      // Mark as paid
      await supabase
        .from("pix_transactions")
        .update({ status: "paid", paid_at: new Date().toISOString(), user_id: userRecord.id })
        .eq("id", pix.id);

      // Credit balance
      const newBalance = userRecord.balance + pixAmount;
      await supabase
        .from("users")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", userRecord.id);

      // Update local cache
      userRecord.balance = newBalance;

      // Ledger
      await supabase.from("ledger").insert({
        id: `ldg_sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: userRecord.id,
        type: "deposit",
        amount: pixAmount,
        balance_after: newBalance,
        reference_id: pix.transaction_id || pix.external_id || pix.id,
        description: `Deposito PIX sync automatico - R$ ${pixAmount.toFixed(2)}`,
      });

      results.push({ pixId: pix.id, email: pix.user_email, amount: pixAmount, status: "confirmado" });
    }

    const confirmed = results.filter(r => r.status === "confirmado").length;
    return NextResponse.json({ success: true, confirmed, total: pending.length, results });
  } catch (error) {
    console.error("Admin bulk confirm error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
