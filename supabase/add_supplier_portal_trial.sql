-- Add trial support to supplier_portal_accounts
-- Trades (electrician) accounts get a 30-day free trial on signup.
-- subscription_status = 'trialing', trial_ends_at = now + 30 days

ALTER TABLE supplier_portal_accounts
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
