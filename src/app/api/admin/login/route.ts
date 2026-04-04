export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminEmail || !adminPassword || !adminSecret) {
      return NextResponse.json({ error: "Admin nao configurado" }, { status: 500 });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return NextResponse.json({ error: "Credenciais invalidas" }, { status: 401 });
    }

    // Return the admin secret as session token — client stores it for API calls
    return NextResponse.json({
      success: true,
      token: adminSecret,
      admin: { email: adminEmail, name: "Admin", role: "super_admin" },
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
