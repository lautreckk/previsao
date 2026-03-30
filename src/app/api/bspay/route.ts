export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { generatePixQRCode, consultTransaction } from "@/lib/bspay";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjUzNDYsImV4cCI6MjA5MDIwMTM0Nn0.Mj_L0h3HGfG4X22Qb3f53oeipNXa91nIGW5-J_zl-kM"
);

function getWebhookUrl(request: NextRequest): string {
  const envUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return `${envUrl.replace(/\/$/, "")}/api/webhook`;
  return `${request.nextUrl.origin}/api/webhook`;
}

function generateQRImageUrl(pixCode: string): string {
  if (!pixCode) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pixCode)}`;
}

// ---- Helper: credit user balance (atomic) ----
async function creditUserBalance(pixRow: {
  id: string;
  user_id: string | null;
  user_email: string;
  amount: number;
  transaction_id: string;
  external_id: string;
}): Promise<boolean> {
  const pixAmount = Number(pixRow.amount);

  // Mark pix as paid (atomic: only if still pending)
  const { data: updated, error: updateErr } = await supabase
    .from("pix_transactions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", pixRow.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateErr || !updated) {
    // Already paid or error — skip to avoid double credit
    return false;
  }

  // Find user
  let userId = pixRow.user_id;
  if (!userId && pixRow.user_email) {
    const { data: u } = await supabase.from("users").select("id").eq("email", pixRow.user_email).maybeSingle();
    if (u) {
      userId = u.id;
      await supabase.from("pix_transactions").update({ user_id: userId }).eq("id", pixRow.id);
    }
  }

  if (!userId) return false;

  // Credit balance
  const { data: user } = await supabase.from("users").select("balance").eq("id", userId).maybeSingle();
  if (!user) return false;

  const newBalance = Number(user.balance) + pixAmount;
  await supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);

  // Ledger entry
  await supabase.from("ledger").insert({
    id: `ldg_pix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    type: "deposit",
    amount: pixAmount,
    balance_after: newBalance,
    reference_id: pixRow.transaction_id || pixRow.external_id || pixRow.id,
    description: `Deposito PIX confirmado - R$ ${pixAmount.toFixed(2)}`,
  });

  console.log(`[creditUserBalance] user=${userId} +R$${pixAmount} = R$${newBalance}`);
  return true;
}

// ---- POST: Generate PIX QR Code ----
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, name, document, email } = body;

    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Valor minimo e R$ 1,00" }, { status: 400 });
    }

    const safeName = name || "Usuario";
    const safeDocument = (document || "00000000000").replace(/\D/g, "") || "00000000000";
    const safeEmail = email || "usuario@winify.com";
    const externalId = `prev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const webhookUrl = getWebhookUrl(request);

    console.log(`[POST /api/bspay] R$${amount} for ${safeEmail} | webhook: ${webhookUrl}`);

    const result = await generatePixQRCode({
      amount: parseFloat(amount),
      externalId,
      payerName: safeName,
      payerDocument: safeDocument,
      payerEmail: safeEmail,
      postbackUrl: webhookUrl,
    });

    console.log("[POST /api/bspay] BSPay response:", JSON.stringify(result));

    const transactionId = result.transactionId || result.transaction_id || result.id || "";
    const qrCode = result.qrcode || result.qr_code || "";
    const qrCodeImage = result.qr_code_image || result.qrCodeImage || generateQRImageUrl(qrCode);

    const { data: userData } = await supabase.from("users").select("id").eq("email", safeEmail.toLowerCase()).maybeSingle();

    await supabase.from("pix_transactions").insert({
      id: externalId,
      user_id: userData?.id || null,
      user_email: safeEmail.toLowerCase(),
      amount: parseFloat(amount),
      status: "pending",
      external_id: externalId,
      transaction_id: transactionId,
      qr_code: qrCode.slice(0, 500),
    });

    return NextResponse.json({
      qrCode,
      qrCodeImage,
      transactionId,
      externalId,
      status: "pending",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[POST /api/bspay] Error:", message);
    return NextResponse.json({ error: `Erro ao processar pagamento: ${message}` }, { status: 500 });
  }
}

// ---- GET: Check payment status (polls DB + BSPay gateway) ----
export async function GET(request: NextRequest) {
  const txId = request.nextUrl.searchParams.get("txId");
  const extId = request.nextUrl.searchParams.get("extId");

  if (!txId && !extId) {
    return NextResponse.json({ error: "txId or extId required" }, { status: 400 });
  }

  // 1. Check our DB first
  let query = supabase.from("pix_transactions").select("*");
  if (txId) query = query.eq("transaction_id", txId);
  else if (extId) query = query.or(`external_id.eq.${extId},id.eq.${extId}`);

  const { data } = await query.maybeSingle();

  // Already paid in DB
  if (data && data.status === "paid") {
    return NextResponse.json({
      status: "PAID",
      amount: data.amount,
      transaction_id: data.transaction_id,
    });
  }

  // 2. Still pending in DB → consult BSPay gateway directly
  if (data && data.transaction_id) {
    console.log(`[GET /api/bspay] Consulting BSPay for txId=${data.transaction_id}`);

    const gatewayResult = await consultTransaction(data.transaction_id);
    console.log(`[GET /api/bspay] BSPay status: ${gatewayResult.status} paid=${gatewayResult.paid}`);

    if (gatewayResult.paid) {
      // BSPay says PAID! Credit the user immediately.
      const credited = await creditUserBalance({
        id: data.id,
        user_id: data.user_id,
        user_email: data.user_email,
        amount: data.amount,
        transaction_id: data.transaction_id,
        external_id: data.external_id || data.id,
      });

      console.log(`[GET /api/bspay] Credited: ${credited}`);

      return NextResponse.json({
        status: "PAID",
        amount: data.amount,
        transaction_id: data.transaction_id,
        credited,
      });
    }
  }

  return NextResponse.json({ status: "PENDING" });
}