export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * BSPay Webhook Handler
 *
 * BSPay sends a POST to the postbackUrl when payment status changes:
 * {
 *   "transactionId": "txn_abc123",
 *   "external_id": "uuid-do-seu-pagamento",
 *   "status": "PAID",
 *   "amount": 50.00
 * }
 *
 * Possible statuses: PAID, PENDING, FAILED, REFUNDED
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    console.log("=== BSPAY WEBHOOK RECEIVED ===");
    console.log("Body:", rawBody);

    const body = JSON.parse(rawBody);

    const event = (body.event || "").toString().toLowerCase();
    const status = (body.status || "").toString().toUpperCase();
    const transactionId = body.transactionId || body.transaction_id || "";
    const externalId = body.external_id || body.externalId || "";
    const bodyAmount = Number(body.amount) || 0;

    console.log(`Webhook: event=${event} status=${status} txId=${transactionId} extId=${externalId} amount=${bodyAmount}`);

    // Accept: status PAID/COMPLETED or event payment.confirmed/pix.received
    const isPaid = status === "PAID" || status === "COMPLETED" || status === "APPROVED"
      || event === "payment.confirmed" || event === "pix.received";

    if (!isPaid) {
      console.log("Webhook: not a payment confirmation, ignoring. event:", event, "status:", status);
      return NextResponse.json({ received: true, ignored: true });
    }

    // 1. Find the pix_transaction
    let existing = null;

    if (externalId) {
      const { data } = await supabase
        .from("pix_transactions")
        .select("id, user_id, user_email, amount, status")
        .or(`external_id.eq.${externalId},id.eq.${externalId}`)
        .maybeSingle();
      existing = data;
    }

    if (!existing && transactionId) {
      const { data } = await supabase
        .from("pix_transactions")
        .select("id, user_id, user_email, amount, status")
        .eq("transaction_id", transactionId)
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      console.error("Webhook: pix_transaction NOT FOUND for extId=" + externalId + " txId=" + transactionId);
      return NextResponse.json({ received: true, warning: "transaction not found" });
    }

    // 2. Skip if already paid (idempotency)
    if (existing.status === "paid") {
      console.log("Webhook: already paid, skipping:", existing.id);
      return NextResponse.json({ received: true, already_paid: true });
    }

    // 3. Update pix_transaction to paid
    await supabase
      .from("pix_transactions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        transaction_id: transactionId || undefined,
      })
      .eq("id", existing.id);

    console.log("Webhook: pix_transaction updated to paid:", existing.id);

    // 4. Credit user balance
    const pixAmount = Number(existing.amount);
    let userId = existing.user_id;

    if (!userId && existing.user_email) {
      const { data: u } = await supabase.from("users").select("id").eq("email", existing.user_email).maybeSingle();
      if (u) {
        userId = u.id;
        await supabase.from("pix_transactions").update({ user_id: userId }).eq("id", existing.id);
      }
    }

    if (userId) {
      const { data: user } = await supabase.from("users").select("balance").eq("id", userId).maybeSingle();
      if (user) {
        const newBalance = Number(user.balance) + pixAmount;
        await supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);
        await supabase.from("ledger").insert({
          id: `ldg_pix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: userId,
          type: "deposit",
          amount: pixAmount,
          balance_after: newBalance,
          reference_id: transactionId || externalId || existing.id,
          description: `Deposito PIX confirmado - R$ ${pixAmount.toFixed(2)}`,
        });
        console.log(`Webhook: BALANCE CREDITED user=${userId} +R$${pixAmount} = R$${newBalance}`);
      } else {
        console.error("Webhook: user record not found for id:", userId);
      }
    } else {
      console.error("Webhook: no user found for pix:", existing.id, "email:", existing.user_email);
    }

    return NextResponse.json({ received: true, credited: true });
  } catch (error) {
    console.error("Webhook CRITICAL error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// GET: Check if webhook endpoint is reachable
export async function GET() {
  return NextResponse.json({
    status: "ok",
    gateway: "BSPay",
    message: "Webhook endpoint is reachable",
    timestamp: new Date().toISOString(),
  });
}