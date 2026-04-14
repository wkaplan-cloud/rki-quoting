-- Sage OAuth 2.0 token storage
-- Run this against your Supabase project (SQL editor or CLI)
-- Adds OAuth token columns to the settings table and removes the old Basic Auth columns

alter table settings
  add column if not exists sage_access_token  text,
  add column if not exists sage_refresh_token text,
  add column if not exists sage_token_expires_at timestamptz;

-- sage_company_id already exists from a prior migration — no change needed.
-- Old Basic Auth columns (sage_api_key, sage_username, sage_password) are kept
-- in the schema so existing rows don't break; the app no longer reads or writes them.
