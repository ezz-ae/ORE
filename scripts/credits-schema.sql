-- ORE Credit Economy Schema
-- Run after data-migration.sql

-- broker_credit_accounts
CREATE TABLE IF NOT EXISTS broker_credit_accounts (
  broker_id   TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES freehold_site_users(id) ON DELETE SET NULL,
  tier        TEXT NOT NULL DEFAULT 'Starter',
  allocated   INTEGER NOT NULL DEFAULT 0,
  cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  cycle_end   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broker_credit_user ON broker_credit_accounts(user_id);

-- credit_ledger — immutable audit log
CREATE TABLE IF NOT EXISTS credit_ledger (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  broker_id  TEXT NOT NULL REFERENCES broker_credit_accounts(broker_id) ON DELETE CASCADE,
  type       TEXT NOT NULL, -- 'allocation' | 'spend' | 'refund' | 'adjustment'
  amount     INTEGER NOT NULL, -- positive = credit in, negative = debit out (in type-specific sign convention)
  note       TEXT,
  meta       JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_broker ON credit_ledger(broker_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON credit_ledger(created_at DESC);

-- ad_spend_allocations — per campaign credit tracking
CREATE TABLE IF NOT EXISTS ad_spend_allocations (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  broker_id         TEXT NOT NULL REFERENCES broker_credit_accounts(broker_id) ON DELETE CASCADE,
  campaign_id       TEXT,
  campaign_name     TEXT,
  credits_allocated INTEGER NOT NULL DEFAULT 0,
  credits_spent     INTEGER NOT NULL DEFAULT 0,
  daily_cap         INTEGER,
  status            TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'exhausted' | 'cancelled'
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_spend_broker ON ad_spend_allocations(broker_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign ON ad_spend_allocations(campaign_id);

-- balance view
CREATE OR REPLACE VIEW broker_credit_balances AS
SELECT
  bca.broker_id,
  bca.user_id,
  bca.tier,
  bca.allocated,
  bca.cycle_start,
  bca.cycle_end,
  COALESCE(SUM(CASE
    WHEN cl.type = 'allocation' THEN  cl.amount
    WHEN cl.type = 'spend'      THEN -cl.amount
    WHEN cl.type = 'refund'     THEN  cl.amount
    WHEN cl.type = 'adjustment' THEN  cl.amount
    ELSE 0
  END), 0)::integer AS balance,
  COALESCE(SUM(CASE WHEN cl.type = 'spend' THEN cl.amount ELSE 0 END), 0)::integer AS total_spent
FROM broker_credit_accounts bca
LEFT JOIN credit_ledger cl ON cl.broker_id = bca.broker_id
GROUP BY bca.broker_id, bca.user_id, bca.tier, bca.allocated, bca.cycle_start, bca.cycle_end;

-- Verification queries
-- SELECT * FROM broker_credit_balances;
-- SELECT COUNT(*) FROM broker_credit_accounts;
