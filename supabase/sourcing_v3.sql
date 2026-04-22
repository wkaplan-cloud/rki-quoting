-- ─── Sourcing Requests v3 migration ─────────────────────────────────────────
-- Run in Supabase SQL editor AFTER sourcing_v2.sql

-- 1. Add work_type (category of work) to sourcing requests
ALTER TABLE sourcing_requests
  ADD COLUMN IF NOT EXISTS work_type text;

-- 2. Add attachment_url to responses if not yet present
ALTER TABLE sourcing_request_responses
  ADD COLUMN IF NOT EXISTS attachment_url text;
