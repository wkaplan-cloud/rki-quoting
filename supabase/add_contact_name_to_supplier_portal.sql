-- Add contact_name to supplier_portal_accounts.
-- Stores the individual contact person's name (separate from the company name).
-- Run in Supabase SQL editor.

ALTER TABLE supplier_portal_accounts
  ADD COLUMN IF NOT EXISTS contact_name text;
