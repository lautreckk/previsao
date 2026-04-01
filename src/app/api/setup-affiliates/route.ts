import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const ref = url.replace("https://", "").replace(".supabase.co", "").trim();

  // Try multiple regions
  const regions = [
    "eu-west-1", "eu-west-2", "eu-central-1",
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "sa-east-1", "ap-southeast-1", "ap-northeast-1", "ap-south-1",
  ];

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch (e) {
    return NextResponse.json({ error: "postgres module not available", detail: String(e) }, { status: 500 });
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, code TEXT UNIQUE NOT NULL, commission_percent NUMERIC(5,2) DEFAULT 10.00, status TEXT DEFAULT 'active', total_referrals INTEGER DEFAULT 0, total_deposits NUMERIC(12,2) DEFAULT 0, total_commission NUMERIC(12,2) DEFAULT 0, total_paid NUMERIC(12,2) DEFAULT 0, balance NUMERIC(12,2) DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, affiliate_id TEXT, affiliate_code TEXT NOT NULL, user_id TEXT, user_name TEXT DEFAULT '', user_email TEXT DEFAULT '', status TEXT DEFAULT 'registered', first_deposit_amount NUMERIC(12,2) DEFAULT 0, first_deposit_at TIMESTAMPTZ, total_deposits NUMERIC(12,2) DEFAULT 0, total_bets NUMERIC(12,2) DEFAULT 0, commission_generated NUMERIC(12,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_id TEXT, referral_id TEXT, user_id TEXT NOT NULL, type TEXT DEFAULT 'deposit', base_amount NUMERIC(12,2) NOT NULL, commission_percent NUMERIC(5,2) NOT NULL, commission_amount NUMERIC(12,2) NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS affiliate_payouts (id TEXT PRIMARY KEY, affiliate_id TEXT, amount NUMERIC(12,2) NOT NULL, method TEXT DEFAULT 'pix', pix_key TEXT DEFAULT '', status TEXT DEFAULT 'pending', paid_at TIMESTAMPTZ, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_code TEXT DEFAULT ''`,
    `CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id)`,
  ];

  // Also try DATABASE_URL if available
  const explicitDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

  const urlsToTry = [
    ...(explicitDbUrl ? [explicitDbUrl] : []),
    ...regions.map(r => `postgresql://postgres.${ref}:${serviceKey}@aws-0-${r}.pooler.supabase.com:6543/postgres`),
    `postgresql://postgres.${ref}:${serviceKey}@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres:${serviceKey}@db.${ref}.supabase.co:5432/postgres`,
    ...regions.map(r => `postgresql://postgres.${ref}:${serviceKey}@aws-0-${r}.pooler.supabase.com:5432/postgres`),
  ];

  for (const connStr of urlsToTry) {
    const masked = connStr.replace(/:([^@]{10})[^@]*@/, ':$1***@');
    try {
      const sql = postgres(connStr, { ssl: { rejectUnauthorized: false }, connect_timeout: 5, idle_timeout: 5 });
      // Test connection
      await sql`SELECT 1 as test`;

      // Run all statements
      const results: { step: string; ok: boolean; error?: string }[] = [];
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt);
          results.push({ step: stmt.slice(0, 50), ok: true });
        } catch (e) {
          results.push({ step: stmt.slice(0, 50), ok: false, error: String(e).slice(0, 200) });
        }
      }

      try { await sql.end(); } catch {}
      return NextResponse.json({ success: results.every(r => r.ok), connection: masked, results });
    } catch (e) {
      // Connection failed, try next
      continue;
    }
  }

  return NextResponse.json({
    success: false,
    error: "Could not connect to database with any region/format",
    tried: urlsToTry.length,
    hint: "Set DATABASE_URL env var in Vercel with your Supabase connection string from Project Settings > Database",
  });
}
