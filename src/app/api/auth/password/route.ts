import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import bcrypt from "bcryptjs";

export async function PUT(request: NextRequest) {
  try {
    const { userId, oldPassword, newPassword } = await request.json();

    if (!userId || !oldPassword || !newPassword) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Nova senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from("users")
      .select("password")
      .eq("id", userId)
      .single();

    if (!data) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
    }

    // Verify old password: bcrypt or plaintext (migration)
    const isValid = data.password.startsWith("$2")
      ? await bcrypt.compare(oldPassword, data.password)
      : oldPassword === data.password;

    if (!isValid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    const { error } = await supabaseAdmin
      .from("users")
      .update({ password: hashedNew, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: "Erro ao alterar senha" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
