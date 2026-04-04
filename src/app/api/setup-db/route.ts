export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return unauthorized();
  }

  const results: string[] = [];

  try {
    // Create users table using raw SQL via rpc
    // Since we can't run DDL directly, we'll use a different approach
    // Try inserting to see if table exists
    const { error: checkError } = await supabase.from("users").select("id").limit(1);

    if (checkError && checkError.message.includes("does not exist")) {
      results.push("Tables don't exist yet. Please run the SQL in Supabase SQL Editor.");
      results.push("File: /supabase_schema.sql");
      return NextResponse.json({ status: "tables_missing", results, sql_needed: true });
    }

    // Tables exist, ensure demo user
    const { data: demo } = await supabase.from("users").select("id").eq("id", "usr_demo_winify").single();
    if (!demo) {
      await supabase.from("users").insert({
        id: "usr_demo_winify", name: "Jogador Demo", email: "demo@winify.com",
        cpf: "00000000000", password: "demo123", balance: 5000,
      });
      results.push("Demo user created");
    } else {
      results.push("Demo user already exists");
    }

    const { data: userCount } = await supabase.from("users").select("id");
    results.push(`Total users: ${userCount?.length || 0}`);

    return NextResponse.json({ status: "ok", results });
  } catch (e) {
    return NextResponse.json({ error: String(e), results }, { status: 500 });
  }
}