-- ─── Sourcing Requests v2 migration ─────────────────────────────────────────
-- Run in Supabase SQL editor AFTER sourcing_requests.sql

-- 1. Separate item quantity from fabric/material quantity
ALTER TABLE sourcing_requests
  ADD COLUMN IF NOT EXISTS item_quantity integer;

-- 2. Store supplier's edited field values + which fields changed
ALTER TABLE sourcing_request_responses
  ADD COLUMN IF NOT EXISTS supplier_edits jsonb,
  ADD COLUMN IF NOT EXISTS changed_fields text[];
