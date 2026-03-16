import { NextRequest, NextResponse } from "next/server";
import { generatePixQRCode, consultTransaction } from "@/lib/bspay";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, name, document, email } = body;

    if (!amount || amount < 1) {
      return NextResponse.json({ error: "Valor mínimo é R$ 1,00" }, { status: 400 });
    }

    if (!name || !document || !email) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }

    const externalId = `prev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseUrl = request.nextUrl.origin;

    const result = await generatePixQRCode({
      amount: parseFloat(amount),
      externalId,
      payerName: name,
      payerDocument: document.replace(/\D/g, ""),
      payerEmail: email,
      postbackUrl: `${baseUrl}/api/webhook`,
    });

    return NextResponse.json({
      qrCode: result.qrcode || result.qr_code || result.pixCopiaECola || result.pix_code || "",
      qrCodeBase64: result.qrcodeBase64 || result.qr_code_base64 || "",
      transactionId: result.transactionId || result.transaction_id || result.pix_id || "",
      externalId,
    });
  } catch (error) {
    console.error("BSPay error:", error);
    return NextResponse.json(
      { error: "Erro ao processar pagamento. Tente novamente." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const txId = request.nextUrl.searchParams.get("txId");

    if (!txId) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });
    }

    const result = await consultTransaction(txId);

    return NextResponse.json({
      status: result.requestBody?.status || result.status || "PENDING",
      data: result,
    });
  } catch (error) {
    console.error("BSPay consult error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar transação" },
      { status: 500 }
    );
  }
}
