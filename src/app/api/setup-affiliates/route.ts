import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }

  const projectRef = url.replace("https://", "").replace(".supabase.co", "");

  const sql = `
    CREATE TABLE IF NOT EXISTS affiliates (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      commission_percent NUMERIC(5,2) DEFAULT 10.00,
      status TEXT DEFAULT 'active',
      total_referrals INTEGER DEFAULT 0,
      total_deposits NUMERIC(12,2) DEFAULT 0,
      total_commission NUMERIC(12,2) DEFAULT 0,
      total_paid NUMERIC(12,2) DEFAULT 0,
      balance NUMERIC(12,2) DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT,
      affiliate_code TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT DEFAULT '',
      user_email TEXT DEFAULT '',
      status TEXT DEFAULT 'registered',
      first_deposit_amount NUMERIC(12,2) DEFAULT 0,
      first_deposit_at TIMESTAMPTZ,
      total_deposits NUMERIC(12,2) DEFAULT 0,
      total_bets NUMERIC(12,2) DEFAULT 0,
      commission_generated NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT,
      referral_id TEXT,
      user_id TEXT NOT NULL,
      type TEXT DEFAULT 'deposit',
      base_amount NUMERIC(12,2) NOT NULL,
      commission_percent NUMERIC(5,2) NOT NULL,
      commission_amount NUMERIC(12,2) NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS affiliate_payouts (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT,
      amount NUMERIC(12,2) NOT NULL,
      method TEXT DEFAULT 'pix',
      pix_key TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_code TEXT DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
    CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
    CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
  `;

  // Try Supabase Management API (requires service role key)
  try {
    const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    // This will fail, but let's try the SQL approach
  } catch {}

  // Use the Supabase SQL API endpoint (works with service role key)
  const results: { step: string; status: string; error?: string }[] = [];

  const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/exec_raw_sql`, {
        method: "POST",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ query: stmt }),
      });

      if (res.ok) {
        results.push({ step: stmt.slice(0, 60), status: "ok" });
      } else {
        const err = await res.text();
        results.push({ step: stmt.slice(0, 60), status: "rpc_failed", error: err });
      }
    } catch (e) {
      results.push({ step: stmt.slice(0, 60), status: "fetch_error", error: String(e) });
    }
  }

  // Fallback: try creating via direct postgres-style endpoint
  try {
    const pgRes = await fetch(`${url}/pg/query`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const pgData = await pgRes.text();
    results.push({ step: "pg/query fallback", status: pgRes.ok ? "ok" : "failed", error: pgRes.ok ? undefined : pgData });
  } catch (e) {
    results.push({ step: "pg/query fallback", status: "failed", error: String(e) });
  }

  return NextResponse.json({
    results,
    instructions: "If all methods failed, please run the SQL manually in Supabase Dashboard > SQL Editor. The SQL is in supabase/migrations/add_affiliates.sql",
  });
}
