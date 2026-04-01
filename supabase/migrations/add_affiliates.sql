-- ============================================================
-- WINIFY - AFFILIATE / REFERRAL SYSTEM
-- ============================================================

-- 1. Affiliates table (each affiliate gets a unique code)
CREATE TABLE IF NOT EXISTS affiliates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,           -- unique referral code (e.g. "joao123")
  commission_percent NUMERIC(5,2) DEFAULT 10.00,  -- % of each referred deposit
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'banned')),
  total_referrals INTEGER DEFAULT 0,
  total_deposits NUMERIC(12,2) DEFAULT 0,
  total_commission NUMERIC(12,2) DEFAULT 0,
  total_paid NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,     -- unpaid commission
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Referrals table (tracks each user referred by an affiliate)
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT REFERENCES affiliates(id),
  affiliate_code TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_name TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'deposited', 'active')),
  first_deposit_amount NUMERIC(12,2) DEFAULT 0,
  first_deposit_at TIMESTAMPTZ,
  total_deposits NUMERIC(12,2) DEFAULT 0,
  total_bets NUMERIC(12,2) DEFAULT 0,
  commission_generated NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Affiliate commissions log
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT REFERENCES affiliates(id),
  referral_id TEXT REFERENCES referrals(id),
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'deposit' CHECK (type IN ('deposit', 'bet', 'bonus', 'manual')),
  base_amount NUMERIC(12,2) NOT NULL,      -- the deposit/bet amount
  commission_percent NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Affiliate payouts
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT REFERENCES affiliates(id),
  amount NUMERIC(12,2) NOT NULL,
  method TEXT DEFAULT 'pix',
  pix_key TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add referrer fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_code TEXT DEFAULT '';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
