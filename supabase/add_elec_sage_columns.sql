-- Sage connection fields on elec_settings
ALTER TABLE elec_settings
  ADD COLUMN IF NOT EXISTS sage_username        text,
  ADD COLUMN IF NOT EXISTS sage_password        text,
  ADD COLUMN IF NOT EXISTS sage_company_id      text,
  ADD COLUMN IF NOT EXISTS sage_access_token    text,
  ADD COLUMN IF NOT EXISTS sage_refresh_token   text,
  ADD COLUMN IF NOT EXISTS sage_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sage_item_id         integer;

-- Sage invoice tracking on elec_claims
ALTER TABLE elec_claims
  ADD COLUMN IF NOT EXISTS sage_invoice_id     text,
  ADD COLUMN IF NOT EXISTS sage_invoice_status text,
  ADD COLUMN IF NOT EXISTS sage_pushed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS sage_customer_id    text,
  ADD COLUMN IF NOT EXISTS sage_customer_name  text;
