import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateSessionToken } from "@/lib/session-token";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/** Check password: try bcrypt first, fallback to plaintext for migration */
async function verifyPassword(input: string, stored: string): Promise<boolean> {
  // If stored password looks like a bcrypt hash ($2a$ or $2b$), compare with bcrypt
  if (stored.startsWith("$2")) {
    return bcrypt.compare(input, stored);
  }
  // Legacy plaintext comparison (will be migrated on successful login)
  return input === stored;
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientIp(request), "login");
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em " + rl.retryAfterSeconds + "s" }, { status: 429 });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }

    if (user) {
      // Block bot accounts from logging in
      if (user.is_bot) {
        return NextResponse.json({ error: "Conta indisponivel" }, { status: 403 });
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
      }

      // Migrate plaintext password to bcrypt on successful login
      if (!user.password.startsWith("$2")) {
        const hashed = await bcrypt.hash(password, 10);
        await supabaseAdmin.from("users").update({ password: hashed }).eq("id", user.id);
      }

      const { password: _, ...safeUser } = user;
      return NextResponse.json({ user: safeUser, sessionToken: generateSessionToken(user.id) });
    }

    // User not found — auto-register with hashed password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { error: insertErr } = await supabaseAdmin.from("users").insert({
      id: newId,
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      cpf: "",
      password: hashedPassword,
      balance: 0,
    });

    if (insertErr) {
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

    const { password: _p, ...safeNewUser } = newUser;
    return NextResponse.json({ user: safeNewUser, sessionToken: generateSessionToken(newUser.id), created: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
