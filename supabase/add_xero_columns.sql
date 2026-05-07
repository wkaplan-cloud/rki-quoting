-- Xero OAuth tokens on settings table
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS xero_access_token TEXT,
  ADD COLUMN IF NOT EXISTS xero_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS xero_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xero_tenant_id TEXT,
  ADD COLUMN IF NOT EXISTS xero_tenant_name TEXT;

-- Xero invoice reference on projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS xero_pushed_at TIMESTAMPTZ;
