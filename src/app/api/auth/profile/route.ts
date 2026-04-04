import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function PUT(request: NextRequest) {
  try {
    const { userId, ...fields } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 });
    }

    // Only allow safe profile fields
    const allowedFields = ["name", "email", "phone", "cpf", "bio", "avatar_url", "is_public"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const key of allowedFields) {
      if (fields[key] !== undefined) {
        updates[key] = key === "email" ? String(fields[key]).toLowerCase() : fields[key];
      }
    }

    const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId);

    if (error) {
      return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
