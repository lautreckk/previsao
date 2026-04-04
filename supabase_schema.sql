-- ============================================================
-- WINIFY - SUPABASE SCHEMA COMPLETO
-- Execute este SQL no SQL Editor do Supabase
-- Ordem: 1) Este arquivo  2) supabase/camera_tables.sql
-- ============================================================

-- ─── USERS ───
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  cpf TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  password TEXT NOT NULL,
  balance NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BETS (mercados gerais, nao-camera) ───
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  market_id TEXT NOT NULL,
  outcome_key TEXT NOT NULL,
  outcome_label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payout_at_entry NUMERIC(12,2) DEFAULT 0,
  final_payout NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEDGER (historico de todas as transacoes financeiras) ───
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) DEFAULT 0,
  reference_id TEXT,
  description TEXT DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PIX TRANSACTIONS (depositos via BSPay) ───
CREATE TABLE IF NOT EXISTS pix_transactions (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  transaction_id TEXT,
  user_id TEXT REFERENCES users(id),
  user_email TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ───
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_transactions ENABLE ROW LEVEL SECURITY;

-- Revoke write access from anon on sensitive tables
REVOKE INSERT, UPDATE, DELETE ON users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON bets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ledger FROM anon;
REVOKE ALL ON pix_transactions FROM anon;

-- Revoke password column from anon — only service_role can read passwords
REVOKE SELECT ON users FROM anon;
GRANT SELECT (
  id, name, email, cpf, phone, avatar_url, balance,
  created_at, updated_at, is_public, is_bot, bio, level,
  total_predictions, total_wins, total_losses, total_wagered,
  total_returns, win_streak, best_streak, rank_position,
  referred_by, affiliate_code
) ON users TO anon;

-- users: anon can READ (without password column)
CREATE POLICY "anon_read_users" ON users FOR SELECT TO anon USING (true);

-- bets: anon can READ only
CREATE POLICY "anon_read_bets" ON bets FOR SELECT TO anon USING (true);

-- ledger: anon can READ only
CREATE POLICY "anon_read_ledger" ON ledger FOR SELECT TO anon USING (true);

-- pix_transactions: NO anon access (service_role bypasses RLS)

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type);
CREATE INDEX IF NOT EXISTS idx_pix_external ON pix_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_pix_user ON pix_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pix_status ON pix_transactions(status);

-- ─── SEED: usuario demo ───
INSERT INTO users (id, name, email, cpf, password, balance)
VALUES ('usr_demo_winify', 'Jogador Demo', 'demo@winify.com', '00000000000', 'demo123', 5000)
ON CONFLICT (id) DO NOTHING;
