export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return unauthorized();
  }

  try {
    const { error: checkError } = await supabase.from("users").select("id").limit(1);

    if (checkError && checkError.message.includes("does not exist")) {
      return NextResponse.json({
        status: "tables_missing",
        message: "Run /supabase_schema.sql in Supabase SQL Editor",
      });
    }

    const { data: userCount } = await supabase.from("users").select("id");
    return NextResponse.json({ status: "ok", total_users: userCount?.length || 0 });
  } catch (e) {
    return NextResponse.json({ error: "Setup check failed" }, { status: 500 });
  }
}
