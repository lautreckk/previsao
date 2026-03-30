-- PREDICTION MARKETS TABLE (migrating from localStorage to Supabase)

CREATE TABLE IF NOT EXISTS prediction_markets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_description TEXT DEFAULT '',
  full_description TEXT DEFAULT '',

  -- Classification
  category TEXT NOT NULL DEFAULT 'custom',
  subcategory TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  country TEXT DEFAULT 'BR',
  language TEXT DEFAULT 'pt-BR',

  -- Display
  banner_url TEXT DEFAULT '',
  is_featured BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'public',

  -- Structure
  market_type TEXT NOT NULL DEFAULT 'binary',
  outcome_type TEXT NOT NULL DEFAULT 'yes_no',
  outcomes JSONB NOT NULL DEFAULT '[]',

  -- Resolution
  resolution_type TEXT DEFAULT 'manual',
  source_type TEXT DEFAULT 'manual',
  source_config JSONB DEFAULT '{}',
  resolution_rule JSONB DEFAULT '{}',
  resolution_evidence TEXT,
  resolution_notes TEXT,

  -- Timing (stored as timestamptz for Supabase, converted to ms in app)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  open_at TIMESTAMPTZ DEFAULT NOW(),
  freeze_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ NOT NULL,
  resolve_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'open',

  -- Financial
  house_fee_percent DECIMAL(5,4) DEFAULT 0.05,
  min_bet DECIMAL(10,2) DEFAULT 1,
  max_bet DECIMAL(10,2) DEFAULT 10000,
  max_payout DECIMAL(10,2) DEFAULT 100000,
  max_liability DECIMAL(10,2) DEFAULT 500000,
  pool_total DECIMAL(10,2) DEFAULT 0,
  distributable_pool DECIMAL(10,2) DEFAULT 0,

  -- Resolution result
  winning_outcome_key TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,

  -- Admin
  created_by TEXT DEFAULT 'system',

  -- Camera (optional)
  stream_url TEXT,
  stream_type TEXT,

  -- AI generation metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_markets_status ON prediction_markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_category ON prediction_markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_close_at ON prediction_markets(close_at);
CREATE INDEX IF NOT EXISTS idx_markets_slug ON prediction_markets(slug);
CREATE INDEX IF NOT EXISTS idx_markets_ai ON prediction_markets(ai_generated);

-- Bets table (migrating from localStorage)
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

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_markets;
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_bets;
