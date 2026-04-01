-- Migration: Add user profile fields for public profiles, ranking, and bot system
-- Run this against your Supabase project

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_predictions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_wagered NUMERIC(12,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_returns NUMERIC(12,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_position INTEGER DEFAULT 0;

-- Index for ranking queries
CREATE INDEX IF NOT EXISTS idx_users_ranking ON users (is_public, total_predictions DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_users_bot ON users (is_bot);
CREATE INDEX IF NOT EXISTS idx_users_level ON users (level DESC);
