import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

// PUT: set or adjust balance (admin only)
export async function PUT(request: NextRequest) {
  if (!checkAdminSecret(request)) return unauthorized();

  try {
    const { userId, balance, delta } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 });
    }

    if (balance !== undefined) {
      // Absolute set
      const { error } = await supabaseAdmin
        .from("users")
        .update({ balance: Math.max(0, Number(balance)), updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: "Erro ao atualizar saldo" }, { status: 500 });
      return NextResponse.json({ success: true, balance: Math.max(0, Number(balance)) });
    }

    if (delta !== undefined) {
      // Relative adjustment
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("balance")
        .eq("id", userId)
        .single();
      if (!user) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });

      const newBalance = Math.max(0, Number(user.balance) + Number(delta));
      const { error } = await supabaseAdmin
        .from("users")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return NextResponse.json({ error: "Erro ao atualizar saldo" }, { status: 500 });
      return NextResponse.json({ success: true, balance: newBalance });
    }

    return NextResponse.json({ error: "balance ou delta obrigatorio" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
