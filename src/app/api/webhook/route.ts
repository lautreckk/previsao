import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("BSPay Webhook received:", JSON.stringify(body, null, 2));

    const { requestBody } = body;

    if (requestBody?.status === "PAID") {
      const externalId = requestBody.external_id;
      const amount = requestBody.amount;
      const transactionId = requestBody.transactionId;

      console.log(`Payment confirmed: ${externalId} - R$ ${amount} - TX: ${transactionId}`);

      // TODO: Credit user balance in your database
      // await creditUserBalance(externalId, amount);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
