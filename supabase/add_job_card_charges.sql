-- Add labour and call-out charge fields to job cards.
-- Run once in Supabase SQL editor.

alter table elec_job_cards
  add column if not exists callout_fee    numeric,
  add column if not exists labour_hours   numeric,
  add column if not exists labour_rate    numeric;
