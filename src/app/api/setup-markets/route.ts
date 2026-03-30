export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Pool } from "pg";

// Run this endpoint once to create the prediction_markets table
// GET /api/setup-markets
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    // Fallback: try to build from Supabase URL
    return NextResponse.json({
      error: "DATABASE_URL not set",
      instructions: [
        "1. Va no Supabase Dashboard > Settings > Database",
        "2. Copie a Connection String (URI)",
        "3. Adicione no .env.local: DATABASE_URL=postgresql://...",
        "4. Ou execute o SQL abaixo no SQL Editor do Supabase:",
      ],
      sql: getSQL(),
    });
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    try {
      await client.query(getSQL());
      return NextResponse.json({ ok: true, message: "Tables created successfully" });
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json({
      error: String(err),
      hint: "Execute o SQL manualmente no Supabase SQL Editor",
      sql: getSQL(),
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

function getSQL() {
  return `
CREATE TABLE IF NOT EXISTS prediction_markets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT DEFAULT '',
  full_description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  subcategory TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  country TEXT DEFAULT 'BR',
  language TEXT DEFAULT 'pt-BR',
  banner_url TEXT DEFAULT '',
  is_featured BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'public',
  market_type TEXT NOT NULL DEFAULT 'binary',
  outcome_type TEXT NOT NULL DEFAULT 'yes_no',
  outcomes JSONB NOT NULL DEFAULT '[]',
  resolution_type TEXT DEFAULT 'manual',
  source_type TEXT DEFAULT 'manual',
  source_config JSONB DEFAULT '{}',
  resolution_rule JSONB DEFAULT '{}',
  resolution_evidence TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  open_at TIMESTAMPTZ DEFAULT NOW(),
  freeze_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ NOT NULL,
  resolve_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  house_fee_percent DECIMAL(5,4) DEFAULT 0.05,
  min_bet DECIMAL(10,2) DEFAULT 1,
  max_bet DECIMAL(10,2) DEFAULT 10000,
  max_payout DECIMAL(10,2) DEFAULT 100000,
  max_liability DECIMAL(10,2) DEFAULT 500000,
  pool_total DECIMAL(10,2) DEFAULT 0,
  distributable_pool DECIMAL(10,2) DEFAULT 0,
  winning_outcome_key TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_by TEXT DEFAULT 'system',
  stream_url TEXT,
  stream_type TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_status ON prediction_markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON prediction_markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_close_at ON prediction_markets(close_at);
CREATE INDEX IF NOT EXISTS idx_markets_slug ON prediction_markets(slug);
CREATE INDEX IF NOT EXISTS idx_markets_ai ON prediction_markets(ai_generated);

CREATE TABLE IF NOT EXISTS prediction_bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL REFERENCES prediction_markets(id),
  outcome_key TEXT NOT NULL,
  outcome_label TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payout_at_entry DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_payout DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bets_market ON prediction_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON prediction_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON prediction_bets(status);
  `.trim();
}
