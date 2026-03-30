-- ============================================================
-- WINIFY - CAMERA TABLES (mercado de previsao por camera)
-- Execute DEPOIS do supabase_schema.sql
-- ============================================================

-- ─── CAMERA MARKETS ───
CREATE TABLE IF NOT EXISTS camera_markets (
  id TEXT PRIMARY KEY,
  stream_url TEXT NOT NULL,
  stream_type TEXT NOT NULL DEFAULT 'youtube',
  camera_id TEXT,
  city TEXT DEFAULT '',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  phase TEXT NOT NULL DEFAULT 'waiting',
  phase_ends_at TIMESTAMPTZ,
  current_count INTEGER NOT NULL DEFAULT 0,
  current_threshold INTEGER NOT NULL DEFAULT 175,
  round_number INTEGER NOT NULL DEFAULT 0,
  round_duration_seconds INTEGER NOT NULL DEFAULT 300,
  thumbnail_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CAMERA ROUNDS ───
CREATE TABLE IF NOT EXISTS camera_rounds (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_number INTEGER NOT NULL DEFAULT 1,
  threshold INTEGER NOT NULL DEFAULT 175,
  phase TEXT NOT NULL DEFAULT 'betting',
  pool_over NUMERIC(12,2) NOT NULL DEFAULT 0,
  pool_under NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_pool NUMERIC(12,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL,
  final_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CAMERA PREDICTIONS ───
CREATE TABLE IF NOT EXISTS camera_predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_id TEXT REFERENCES camera_rounds(id),
  prediction_type TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  amount_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  odds_at_entry NUMERIC(8,4) NOT NULL DEFAULT 1.90,
  payout NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_camera_markets_status ON camera_markets(status);
CREATE INDEX IF NOT EXISTS idx_camera_markets_phase ON camera_markets(phase);
CREATE INDEX IF NOT EXISTS idx_camera_rounds_market ON camera_rounds(market_id);
CREATE INDEX IF NOT EXISTS idx_camera_rounds_unresolved ON camera_rounds(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camera_predictions_round ON camera_predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_user ON camera_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_market ON camera_predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_status ON camera_predictions(status);

-- ─── RLS ───
ALTER TABLE camera_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on camera_markets" ON camera_markets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on camera_rounds" ON camera_rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on camera_predictions" ON camera_predictions FOR ALL USING (true) WITH CHECK (true);

-- ─── REALTIME ───
-- Habilita atualizacoes em tempo real para contagem de veiculos
ALTER PUBLICATION supabase_realtime ADD TABLE camera_markets;

-- REPLICA IDENTITY FULL para postgres_changes funcionar com updates
ALTER TABLE camera_markets REPLICA IDENTITY FULL;
ALTER TABLE camera_rounds REPLICA IDENTITY FULL;
