export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { consultTransaction } from "@/lib/bspay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

const WEBHOOK_TOKEN = process.env.WEBHOOK_SECRET || process.env.WORKER_SECRET || "";

/**
 * Validate the webhook secret token from query parameter.
 * The webhook URL registered with BSPay includes ?token=<secret>
 */
function validateWebhookToken(request: NextRequest): boolean {
  if (!WEBHOOK_TOKEN) return true; // Fallback if not configured yet
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!token || token.length !== WEBHOOK_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(WEBHOOK_TOKEN));
  } catch {
    return false;
  }
}

/**
 * BSPay Webhook Handler — with security hardening:
 * 1. URL token validation (shared secret)
 * 2. Transaction must exist in our DB (created by /api/bspay)
 * 3. Server-side verification via BSPay API before crediting
 * 4. Atomic idempotency (UPDATE WHERE status = 'pending')
 */
export async function POST(request: NextRequest) {
  // 0. Rate limit
  const rl = checkRateLimit(getClientIp(request), "webhook");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // 1. Validate webhook token
  if (!validateWebhookToken(request)) {
    console.warn("[Webhook] Invalid or missing token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const event = (body.event || "").toString().toLowerCase();
    const status = (body.status || "").toString().toUpperCase();
    const transactionId = body.transactionId || body.transaction_id || "";
    const externalId = body.external_id || body.externalId || "";

    console.log(`[Webhook] event=${event} status=${status} extId=${externalId ? externalId.slice(0, 20) : "none"}`);

    // Accept: status PAID/COMPLETED or event payment.confirmed/pix.received
    const isPaid = status === "PAID" || status === "COMPLETED" || status === "APPROVED"
      || event === "payment.confirmed" || event === "pix.received";

    if (!isPaid) {
      return NextResponse.json({ received: true, ignored: true });
    }

    // 2. Find the pix_transaction in our DB (must exist — created by /api/bspay)
    let existing = null;

    if (externalId) {
      const { data: byExtId } = await supabase
        .from("pix_transactions")
        .select("id, user_id, user_email, amount, status, transaction_id")
        .eq("external_id", externalId)
        .maybeSingle();

      if (byExtId) {
        existing = byExtId;
      } else {
        const { data: byId } = await supabase
          .from("pix_transactions")
          .select("id, user_id, user_email, amount, status, transaction_id")
          .eq("id", externalId)
          .maybeSingle();
        existing = byId;
      }
    }

    if (!existing && transactionId) {
      const { data } = await supabase
        .from("pix_transactions")
        .select("id, user_id, user_email, amount, status, transaction_id")
        .eq("transaction_id", transactionId)
        .maybeSingle();
      existing = data;
    }

    if (!existing) {
      console.warn("[Webhook] Transaction not found in DB");
      return NextResponse.json({ received: true, warning: "transaction not found" });
    }

    // 3. Skip if already paid (idempotency)
    if (existing.status === "paid") {
      return NextResponse.json({ received: true, already_paid: true });
    }

    // 4. Verify payment with BSPay API before crediting
    const txIdForVerify = transactionId || existing.transaction_id;
    if (txIdForVerify) {
      const verification = await consultTransaction(txIdForVerify);
      if (!verification.paid) {
        console.warn("[Webhook] BSPay verification failed — transaction not confirmed as paid");
        return NextResponse.json({ received: true, warning: "payment not verified" }, { status: 200 });
      }
    }

    // 5. Atomic update: mark as paid ONLY if still pending (prevents double credit)
    const { data: updated, error: updateErr } = await supabase
      .from("pix_transactions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        transaction_id: transactionId || existing.transaction_id || undefined,
      })
      .eq("id", existing.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateErr || !updated) {
      // Already processed by another request or error
      return NextResponse.json({ received: true, already_paid: true });
    }

    // 6. Credit user balance
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
        console.log(`[Webhook] Balance credited for user ${userId.slice(0, 12)}...`);
      }
    }

    return NextResponse.json({ received: true, credited: true });
  } catch (error) {
    console.error("[Webhook] Processing error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// GET: Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    gateway: "BSPay",
    message: "Webhook endpoint is reachable",
    timestamp: new Date().toISOString(),
  });
}
