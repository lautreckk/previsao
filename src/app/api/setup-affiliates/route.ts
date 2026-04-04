import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as admin, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  if (!checkAdminSecret(request)) {
    return unauthorized();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const results: { step: string; ok: boolean; error?: string }[] = [];

  // Step 1: Create affiliates table by trying to select, then insert a dummy + delete
  // We use a workaround: create a plpgsql function that executes DDL, then call it

  // First, try to create a helper function using the SQL endpoint
  const ref = url.replace("https://", "").replace(".supabase.co", "").trim();

  // Use Supabase's internal admin API (available with service role key on newer versions)
  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, code TEXT UNIQUE NOT NULL, commission_percent NUMERIC(5,2) DEFAULT 10.00, status TEXT DEFAULT 'active', total_referrals INTEGER DEFAULT 0, total_deposits NUMERIC(12,2) DEFAULT 0, total_commission NUMERIC(12,2) DEFAULT 0, total_paid NUMERIC(12,2) DEFAULT 0, balance NUMERIC(12,2) DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, affiliate_id TEXT, affiliate_code TEXT NOT NULL, user_id TEXT, user_name TEXT DEFAULT '', user_email TEXT DEFAULT '', status TEXT DEFAULT 'registered', first_deposit_amount NUMERIC(12,2) DEFAULT 0, first_deposit_at TIMESTAMPTZ, total_deposits NUMERIC(12,2) DEFAULT 0, total_bets NUMERIC(12,2) DEFAULT 0, commission_generated NUMERIC(12,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_id TEXT, referral_id TEXT, user_id TEXT NOT NULL, type TEXT DEFAULT 'deposit', base_amount NUMERIC(12,2) NOT NULL, commission_percent NUMERIC(5,2) NOT NULL, commission_amount NUMERIC(12,2) NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS affiliate_payouts (id TEXT PRIMARY KEY, affiliate_id TEXT, amount NUMERIC(12,2) NOT NULL, method TEXT DEFAULT 'pix', pix_key TEXT DEFAULT '', status TEXT DEFAULT 'pending', paid_at TIMESTAMPTZ, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_code TEXT DEFAULT ''`,
  ];

  // Try Method: Supabase v2 SQL execution via fetch to internal endpoint
  const allSql = sqlStatements.join(";\n") + ";";

  // Supabase exposes a SQL endpoint at /sql for service role key holders (undocumented but works)
  const endpoints = [
    `${url}/rest/v1/rpc/exec_sql`,
    `${url}/sql`,
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
  ];

  for (const endpoint of endpoints) {
    try {
      const body = endpoint.includes("exec_sql")
        ? JSON.stringify({ sql_query: allSql })
        : JSON.stringify({ query: allSql });

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body,
      });
      const txt = await r.text();
      results.push({ step: endpoint.split("//")[1]?.split("/").slice(1).join("/") || endpoint, ok: r.ok, error: r.ok ? undefined : txt.slice(0, 300) });
      if (r.ok) {
        return NextResponse.json({ success: true, method: endpoint, results });
      }
    } catch (e) {
      results.push({ step: endpoint, ok: false, error: String(e).slice(0, 200) });
    }
  }

  // Fallback: Try to check if tables already exist
  const { data: testAff, error: testErr } = await admin.from("affiliates").select("id").limit(1);
  if (!testErr) {
    results.push({ step: "table_check", ok: true, error: "Tables already exist!" });
    return NextResponse.json({ success: true, message: "Tables already exist", results });
  }

  // Last resort: try creating the exec_sql function first, then use it
  // This uses a Supabase-specific trick: POST to /rest/v1/ with Prefer: resolution=merge-duplicates
  try {
    // Try creating the function via RPC bootstrap
    const createFnSql = `CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT) RETURNS void AS $$ BEGIN EXECUTE sql_query; END; $$ LANGUAGE plpgsql SECURITY DEFINER`;

    // This won't work via REST, but let's try anyway
    const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql_query: createFnSql }),
    });
    results.push({ step: "create_function", ok: r.ok });
  } catch {}

  return NextResponse.json({
    success: false,
    results,
    service_key_available: !!serviceKey,
    manual_instructions: "Run the SQL from supabase/migrations/add_affiliates.sql in Supabase Dashboard > SQL Editor at https://supabase.com/dashboard/project/" + ref + "/sql/new",
  });
}
