import { NextResponse } from "next/server";

export async function GET() {
  // List env var names that contain useful keywords (no values for security)
  const envKeys = Object.keys(process.env).filter(k =>
    /supabase|postgres|database|db_|pool/i.test(k)
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || "";
  const ref = url.replace("https://", "").replace(".supabase.co", "");

  // Try using service role key with Supabase's internal query endpoint
  const sql = `
CREATE TABLE IF NOT EXISTS affiliates (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, email TEXT NOT NULL, code TEXT UNIQUE NOT NULL, commission_percent NUMERIC(5,2) DEFAULT 10.00, status TEXT DEFAULT 'active', total_referrals INTEGER DEFAULT 0, total_deposits NUMERIC(12,2) DEFAULT 0, total_commission NUMERIC(12,2) DEFAULT 0, total_paid NUMERIC(12,2) DEFAULT 0, balance NUMERIC(12,2) DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS referrals (id TEXT PRIMARY KEY, affiliate_id TEXT, affiliate_code TEXT NOT NULL, user_id TEXT, user_name TEXT DEFAULT '', user_email TEXT DEFAULT '', status TEXT DEFAULT 'registered', first_deposit_amount NUMERIC(12,2) DEFAULT 0, first_deposit_at TIMESTAMPTZ, total_deposits NUMERIC(12,2) DEFAULT 0, total_bets NUMERIC(12,2) DEFAULT 0, commission_generated NUMERIC(12,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS affiliate_commissions (id TEXT PRIMARY KEY, affiliate_id TEXT, referral_id TEXT, user_id TEXT NOT NULL, type TEXT DEFAULT 'deposit', base_amount NUMERIC(12,2) NOT NULL, commission_percent NUMERIC(5,2) NOT NULL, commission_amount NUMERIC(12,2) NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS affiliate_payouts (id TEXT PRIMARY KEY, affiliate_id TEXT, amount NUMERIC(12,2) NOT NULL, method TEXT DEFAULT 'pix', pix_key TEXT DEFAULT '', status TEXT DEFAULT 'pending', paid_at TIMESTAMPTZ, notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW());
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_code TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
  `.trim();

  const results: { method: string; ok: boolean; detail?: string }[] = [];

  // Method 1: Supabase Management API via service role key (internal SQL endpoint)
  if (serviceKey) {
    try {
      const r = await fetch(`https://${ref}.supabase.co/rest/v1/`, {
        method: "OPTIONS",
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      });
      results.push({ method: "service_key_check", ok: r.ok, detail: `status=${r.status}` });
    } catch (e) { results.push({ method: "service_key_check", ok: false, detail: String(e) }); }

    // Try the Supabase project's SQL execution via the management/admin endpoint
    for (const endpoint of [
      `https://${ref}.supabase.co/pg/query`,
      `https://${ref}.supabase.co/rest/v1/rpc/`,
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
    ]) {
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "x-supabase-api-key": serviceKey,
          },
          body: JSON.stringify({ query: sql }),
        });
        const txt = await r.text();
        results.push({ method: endpoint.split("/").slice(-2).join("/"), ok: r.ok, detail: txt.slice(0, 200) });
        if (r.ok) break;
      } catch (e) { results.push({ method: endpoint, ok: false, detail: String(e) }); }
    }
  }

  // Method 2: Direct postgres connection if DATABASE_URL available
  if (dbUrl) {
    results.push({ method: "db_url_found", ok: true, detail: "DATABASE_URL is available, could use pg module" });
  }

  return NextResponse.json({
    env_keys: envKeys,
    has_service_key: !!serviceKey,
    has_db_url: !!dbUrl,
    ref,
    results,
  });
}
