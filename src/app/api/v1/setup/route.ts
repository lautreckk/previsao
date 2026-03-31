export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../_lib/auth";
import { createClient } from "@supabase/supabase-js";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * POST /api/v1/setup
 *
 * Creates all required tables for the Data Provider API.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const supabase = sb();
  const results: { table: string; status: string }[] = [];

  // 1. API Keys table
  const { error: e1 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        permissions TEXT[] DEFAULT ARRAY['read'],
        rate_limit_per_minute INT DEFAULT 60,
        is_active BOOLEAN DEFAULT true,
        request_count BIGINT DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
    `,
  });
  results.push({ table: "api_keys", status: e1 ? `error: ${e1.message}` : "ok" });

  // 2. Live Rounds table (for financial sobe/desce)
  const { error: e2 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS live_rounds (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        market_key TEXT NOT NULL,
        symbol TEXT NOT NULL,
        category TEXT DEFAULT 'crypto',
        round_number BIGINT NOT NULL,
        open_price DECIMAL(20,8) NOT NULL,
        close_price DECIMAL(20,8),
        status TEXT DEFAULT 'betting' CHECK (status IN ('waiting','betting','observation','resolved','cancelled')),
        winning_outcome TEXT CHECK (winning_outcome IN ('UP','DOWN')),
        pool_up DECIMAL(12,2) DEFAULT 0,
        pool_down DECIMAL(12,2) DEFAULT 0,
        pool_total DECIMAL(12,2) DEFAULT 0,
        payout_per_unit DECIMAL(10,4) DEFAULT 0,
        house_fee DECIMAL(12,2) DEFAULT 0,
        duration_seconds INT DEFAULT 300,
        started_at TIMESTAMPTZ NOT NULL,
        betting_ends_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_live_rounds_market ON live_rounds(market_key, status);
      CREATE INDEX IF NOT EXISTS idx_live_rounds_status ON live_rounds(status);
    `,
  });
  results.push({ table: "live_rounds", status: e2 ? `error: ${e2.message}` : "ok" });

  // 3. Live Bets table
  const { error: e3 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS live_bets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        round_id UUID NOT NULL REFERENCES live_rounds(id),
        user_id UUID NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('UP','DOWN')),
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        odds_at_entry DECIMAL(10,4) DEFAULT 0,
        payout DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','won','lost','refunded','cancelled')),
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_live_bets_round ON live_bets(round_id, status);
      CREATE INDEX IF NOT EXISTS idx_live_bets_user ON live_bets(user_id);
    `,
  });
  results.push({ table: "live_bets", status: e3 ? `error: ${e3.message}` : "ok" });

  // 4. Price Snapshots table (for historical charts)
  const { error: e4 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS price_snapshots (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        price DECIMAL(20,8) NOT NULL,
        source TEXT NOT NULL,
        captured_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol ON price_snapshots(symbol, captured_at DESC);
    `,
  });
  results.push({ table: "price_snapshots", status: e4 ? `error: ${e4.message}` : "ok" });

  // 5. Weather Snapshots table
  const { error: e5 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS weather_snapshots (
        id BIGSERIAL PRIMARY KEY,
        city TEXT NOT NULL,
        temperature DECIMAL(5,1) NOT NULL,
        humidity INT,
        description TEXT,
        captured_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_weather_snapshots_city ON weather_snapshots(city, captured_at DESC);
    `,
  });
  results.push({ table: "weather_snapshots", status: e5 ? `error: ${e5.message}` : "ok" });

  // 6. Helper functions
  const { error: e6 } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE OR REPLACE FUNCTION increment_balance(user_id_param UUID, amount_param DECIMAL)
      RETURNS void AS $$
      BEGIN
        UPDATE users SET balance = balance + amount_param WHERE id = user_id_param;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION decrement_balance(user_id_param UUID, amount_param DECIMAL)
      RETURNS void AS $$
      BEGIN
        UPDATE users SET balance = balance - amount_param WHERE id = user_id_param AND balance >= amount_param;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient balance';
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `,
  });
  results.push({ table: "helper_functions", status: e6 ? `error: ${e6.message}` : "ok" });

  // 7. Generate a default API key if none exists
  const { data: existingKeys } = await supabase.from("api_keys").select("id").limit(1);
  if (!existingKeys || existingKeys.length === 0) {
    const defaultKey = `wfp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await supabase.from("api_keys").insert({
      key: defaultKey,
      name: "Default Key",
      owner_id: "system",
      permissions: ["read", "write", "resolve"],
      rate_limit_per_minute: 120,
    });
    results.push({ table: "default_api_key", status: `created: ${defaultKey}` });
  }

  return apiSuccess(results, { note: "Run this once to set up the database. Idempotent." });
}

/**
 * GET /api/v1/setup
 *
 * Returns the raw SQL for manual execution if rpc fails.
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const sql = `
-- ============================================================
-- WINIFY DATA PROVIDER API - Database Setup
-- Run this in Supabase SQL Editor if POST /api/v1/setup fails
-- ============================================================

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['read'],
  rate_limit_per_minute INT DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  request_count BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Live Rounds (Sobe/Desce automático)
CREATE TABLE IF NOT EXISTS live_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  market_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  category TEXT DEFAULT 'crypto',
  round_number BIGINT NOT NULL,
  open_price DECIMAL(20,8) NOT NULL,
  close_price DECIMAL(20,8),
  status TEXT DEFAULT 'betting',
  winning_outcome TEXT,
  pool_up DECIMAL(12,2) DEFAULT 0,
  pool_down DECIMAL(12,2) DEFAULT 0,
  pool_total DECIMAL(12,2) DEFAULT 0,
  payout_per_unit DECIMAL(10,4) DEFAULT 0,
  house_fee DECIMAL(12,2) DEFAULT 0,
  duration_seconds INT DEFAULT 300,
  started_at TIMESTAMPTZ NOT NULL,
  betting_ends_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Live Bets
CREATE TABLE IF NOT EXISTS live_bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES live_rounds(id),
  user_id UUID NOT NULL,
  outcome TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  odds_at_entry DECIMAL(10,4) DEFAULT 0,
  payout DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price Snapshots (histórico para gráficos)
CREATE TABLE IF NOT EXISTS price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  price DECIMAL(20,8) NOT NULL,
  source TEXT NOT NULL,
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- Weather Snapshots
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  temperature DECIMAL(5,1) NOT NULL,
  humidity INT,
  description TEXT,
  captured_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_live_rounds_market ON live_rounds(market_key, status);
CREATE INDEX IF NOT EXISTS idx_live_rounds_status ON live_rounds(status);
CREATE INDEX IF NOT EXISTS idx_live_bets_round ON live_bets(round_id, status);
CREATE INDEX IF NOT EXISTS idx_live_bets_user ON live_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_symbol ON price_snapshots(symbol, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_city ON weather_snapshots(city, captured_at DESC);

-- Helper functions
CREATE OR REPLACE FUNCTION increment_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE users SET balance = balance + amount_param WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_balance(user_id_param UUID, amount_param DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE users SET balance = balance - amount_param WHERE id = user_id_param AND balance >= amount_param;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
END;
$$ LANGUAGE plpgsql;

-- exec_sql helper (for API setup)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void AS $$
BEGIN EXECUTE sql; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `.trim();

  return apiSuccess({ sql }, { note: "Copy this SQL and run in Supabase SQL Editor" });
}
