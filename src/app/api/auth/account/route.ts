import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", userId);

    if (error) {
      return NextResponse.json({ error: "Erro ao deletar conta" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
