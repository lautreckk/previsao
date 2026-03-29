-- Camera Markets
CREATE TABLE IF NOT EXISTS camera_markets (
  id TEXT PRIMARY KEY,
  stream_url TEXT NOT NULL,
  stream_type TEXT NOT NULL DEFAULT 'youtube',
  city TEXT DEFAULT '',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_count INTEGER NOT NULL DEFAULT 0,
  round_duration_seconds INTEGER NOT NULL DEFAULT 300,
  thumbnail_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camera Rounds
CREATE TABLE IF NOT EXISTS camera_rounds (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NOT NULL,
  final_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camera Predictions
CREATE TABLE IF NOT EXISTS camera_predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  market_id TEXT NOT NULL REFERENCES camera_markets(id),
  round_id TEXT REFERENCES camera_rounds(id),
  predicted_min INTEGER NOT NULL,
  predicted_max INTEGER NOT NULL,
  amount_brl DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_camera_rounds_market ON camera_rounds(market_id);
CREATE INDEX IF NOT EXISTS idx_camera_rounds_unresolved ON camera_rounds(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camera_predictions_round ON camera_predictions(round_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_user ON camera_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_camera_predictions_market ON camera_predictions(market_id);

-- Enable Realtime on camera_markets
ALTER PUBLICATION supabase_realtime ADD TABLE camera_markets;
