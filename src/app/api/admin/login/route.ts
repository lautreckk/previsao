export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function generateAdminToken(): string {
  const secret = process.env.ADMIN_SECRET || "";
  const ts = Date.now().toString();
  const payload = `admin:${ts}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${hmac}`;
}

function validateAdminToken(token: string): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_SECRET || "";
  const parts = token.split(":");
  if (parts.length !== 3) return false;
  const [role, ts, providedHmac] = parts;
  if (role !== "admin") return false;
  const tokenAge = Date.now() - parseInt(ts, 10);
  if (isNaN(tokenAge) || tokenAge > ADMIN_TOKEN_TTL_MS || tokenAge < 0) return false;
  const payload = `${role}:${ts}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword || !process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Admin nao configurado" }, { status: 500 });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    // Generate a time-limited signed token instead of returning raw ADMIN_SECRET
    const adminToken = generateAdminToken();

    const response = NextResponse.json({
      success: true,
      token: adminToken,
      admin: { email: adminEmail, name: "Admin", role: "super_admin" },
    });

    // Set HttpOnly cookie — immune to XSS
    response.cookies.set("admin_session", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
