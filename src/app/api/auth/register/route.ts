import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateSessionToken } from "@/lib/session-token";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientIp(request), "register");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em " + rl.retryAfterSeconds + "s" }, { status: 429 });
  }

  try {
    const { name, email, cpf, password, phone, referralCode } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 });
    }

    const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const insertData: Record<string, unknown> = {
      id: newId,
      name,
      email: normalizedEmail,
      cpf: cpf || "",
      password: await bcrypt.hash(password, 10),
      balance: 0,
      phone: phone || "",
    };
    if (referralCode) insertData.referred_by = referralCode;

    const { error } = await supabaseAdmin.from("users").insert(insertData);

    if (error) {
      return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
    }

    const { data: newUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", newId)
      .single();

    if (!newUser) {
      return NextResponse.json({ error: "Erro ao buscar usuario" }, { status: 500 });
    }

    const { password: _, ...safeUser } = newUser;
    return NextResponse.json({ user: safeUser, sessionToken: generateSessionToken(newUser.id) });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
