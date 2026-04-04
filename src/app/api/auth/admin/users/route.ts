import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, checkAdminSecret, unauthorized } from "@/lib/supabase-server";
import bcrypt from "bcryptjs";

// GET: list all users (admin only)
export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar usuarios" }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

// PUT: update user (admin only)
export async function PUT(request: NextRequest) {
  if (!checkAdminSecret(request)) return unauthorized();

  try {
    const { userId, ...fields } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ["name", "email", "cpf", "password"];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        if (key === "password" && String(fields[key]).length < 6) continue;
        if (key === "password") {
          updates[key] = await bcrypt.hash(String(fields[key]), 10);
        } else {
          updates[key] = key === "email" ? String(fields[key]).toLowerCase() : fields[key];
        }
      }
    }

    const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Erro ao atualizar usuario" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE: delete user (admin only)
export async function DELETE(request: NextRequest) {
  if (!checkAdminSecret(request)) return unauthorized();

  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Erro ao deletar usuario" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
