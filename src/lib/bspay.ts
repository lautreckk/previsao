const BSPAY_CLIENT_ID = process.env.BSPAY_CLIENT_ID!;
const BSPAY_CLIENT_SECRET = process.env.BSPAY_CLIENT_SECRET!;
const BSPAY_BASE_URL = "https://api.bspay.co/v2";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getBspayToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${BSPAY_CLIENT_ID}:${BSPAY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(`${BSPAY_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BSPay auth failed: ${res.status} ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 - 60000 : 3500000),
  };

  return cachedToken.token;
}

export interface PixQRCodeRequest {
  amount: number;
  externalId: string;
  payerName: string;
  payerDocument: string;
  payerEmail: string;
  postbackUrl: string;
}

export async function generatePixQRCode(req: PixQRCodeRequest) {
  const token = await getBspayToken();

  const payload = {
    amount: req.amount,
    external_id: req.externalId,
    payerQuestion: "Depósito Previsao.io",
    payer: {
      name: req.payerName,
      document: req.payerDocument,
      email: req.payerEmail,
    },
    postbackUrl: req.postbackUrl,
  };

  const res = await fetch(`${BSPAY_BASE_URL}/pix/qrcode`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BSPay QR failed: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function consultTransaction(pixId: string) {
  const token = await getBspayToken();

  const res = await fetch(`${BSPAY_BASE_URL}/consult-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ pix_id: pixId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BSPay consult failed: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getBalance() {
  const token = await getBspayToken();

  const res = await fetch(`${BSPAY_BASE_URL}/balance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`BSPay balance failed: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}
