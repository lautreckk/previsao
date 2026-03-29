/**
 * BSPay API Integration
 * Base URL: https://api.bspay.co/v2
 * Auth: OAuth2 Basic Auth → Bearer token
 */

const BSPAY_CLIENT_ID = process.env.BSPAY_CLIENT_ID!;
const BSPAY_CLIENT_SECRET = process.env.BSPAY_CLIENT_SECRET!;
const BSPAY_BASE_URL = "https://api.bspay.co/v2";

// ---- OAuth2 Token Cache (~150s) ----
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${BSPAY_CLIENT_ID}:${BSPAY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(`${BSPAY_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`BSPay OAuth failed: ${res.status} - ${text}`);

  const data = JSON.parse(text);
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 150) * 1000;
  return cachedToken!;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ---- Generate PIX QR Code ----

export interface PixQRCodeRequest {
  amount: number;
  externalId: string;
  payerName: string;
  payerDocument: string;
  payerEmail: string;
  postbackUrl: string;
}

export async function generatePixQRCode(req: PixQRCodeRequest) {
  const token = await getAccessToken();

  const payload = {
    amount: req.amount,
    external_id: req.externalId,
    postbackUrl: req.postbackUrl,
    payer: {
      name: req.payerName,
      document: req.payerDocument.replace(/\D/g, ""),
    },
  };

  console.log("[BSPay] Creating PIX:", JSON.stringify(payload));

  const res = await fetch(`${BSPAY_BASE_URL}/pix/qrcode`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("[BSPay] PIX response:", res.status, text);

  if (!res.ok) {
    if (res.status === 401) {
      cachedToken = null;
      const newToken = await getAccessToken();
      const retry = await fetch(`${BSPAY_BASE_URL}/pix/qrcode`, {
        method: "POST",
        headers: authHeaders(newToken),
        body: JSON.stringify(payload),
      });
      const retryText = await retry.text();
      if (!retry.ok) throw new Error(`BSPay PIX failed: ${retry.status} - ${retryText}`);
      return JSON.parse(retryText);
    }
    throw new Error(`BSPay PIX failed: ${res.status} - ${text}`);
  }

  return JSON.parse(text);
}

// ---- Consult Transaction Status ----

export async function consultTransaction(pixId: string): Promise<{ paid: boolean; status: string; raw: Record<string, unknown> }> {
  try {
    const token = await getAccessToken();

    const res = await fetch(`${BSPAY_BASE_URL}/consult-transaction`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ pix_id: pixId }),
    });

    const text = await res.text();

    if (!res.ok) {
      // Retry with fresh token on 401
      if (res.status === 401) {
        cachedToken = null;
        const newToken = await getAccessToken();
        const retry = await fetch(`${BSPAY_BASE_URL}/consult-transaction`, {
          method: "POST",
          headers: authHeaders(newToken),
          body: JSON.stringify({ pix_id: pixId }),
        });
        const retryText = await retry.text();
        if (!retry.ok) return { paid: false, status: "ERROR", raw: {} };
        const retryData = JSON.parse(retryText);
        const retryStatus = (retryData.requestBody?.status || "").toUpperCase();
        return { paid: retryStatus === "PAID" || retryStatus === "COMPLETED" || retryStatus === "APPROVED", status: retryStatus, raw: retryData };
      }
      return { paid: false, status: "ERROR", raw: {} };
    }

    const data = JSON.parse(text);
    const status = (data.requestBody?.status || data.status || "").toUpperCase();
    const isPaid = status === "PAID" || status === "COMPLETED" || status === "APPROVED";

    return { paid: isPaid, status, raw: data };
  } catch (err) {
    console.error("[BSPay] consultTransaction error:", err);
    return { paid: false, status: "ERROR", raw: {} };
  }
}

// ---- PIX Withdrawal ----

export interface PixWithdrawalRequest {
  amount: number;
  pixKey: string;
  pixKeyType: "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";
  taxId: string;
  name: string;
  externalId: string;
}

export async function requestWithdrawal(req: PixWithdrawalRequest) {
  const token = await getAccessToken();

  const payload = {
    amount: req.amount,
    external_id: req.externalId,
    creditParty: {
      name: req.name,
      keyType: req.pixKeyType,
      key: req.pixKey,
      taxId: req.taxId,
    },
  };

  const res = await fetch(`${BSPAY_BASE_URL}/pix/payment`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`BSPay withdrawal failed: ${res.status} - ${text}`);
  return JSON.parse(text);
}
