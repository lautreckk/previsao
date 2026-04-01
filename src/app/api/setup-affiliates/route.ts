import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });

  const results: { step: string; ok: boolean; error?: string }[] = [];

  // Check if tables already exist
  const { error: checkErr } = await admin.from("affiliates").select("id").limit(1);
  if (!checkErr) {
    return NextResponse.json({ success: true, message: "Tables already exist!" });
  }

  // Tables don't exist. We need to create them.
  // Since we can't run DDL via REST API, let's use the Supabase Management API
  // which requires a different auth. But we can try creating an RPC function bootstrap.

  // Approach: Use the Supabase internal pg-meta API endpoint (used by the dashboard)
  const ref = url.replace("https://", "").replace(".supabase.co", "").trim();

  // The Supabase Dashboard uses this endpoint to execute SQL:
  // POST https://{ref}.supabase.co/pg-meta/default/query
  // with service role key as bearer token
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

  // Try pg-meta endpoint (used by Supabase Studio/Dashboard)
  const pgMetaEndpoints = [
    `${url}/pg-meta/default/query`,
    `${url}/pg/query`,
    `https://${ref}.supabase.co/pg-meta/default/query`,
  ];

  for (const endpoint of pgMetaEndpoints) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
          "x-connection-encrypted": "false",
        },
        body: JSON.stringify({ query: sql }),
      });
      const txt = await r.text();
      results.push({
        step: endpoint.replace(url, "").replace(`https://${ref}.supabase.co`, ""),
        ok: r.ok,
        error: r.ok ? undefined : txt.slice(0, 300),
      });
      if (r.ok) {
        // Verify tables were created
        const { error: verifyErr } = await admin.from("affiliates").select("id").limit(1);
        return NextResponse.json({
          success: !verifyErr,
          method: endpoint,
          verified: !verifyErr,
          results,
        });
      }
    } catch (e) {
      results.push({ step: endpoint, ok: false, error: String(e).slice(0, 200) });
    }
  }

  return NextResponse.json({ success: false, results });
}
