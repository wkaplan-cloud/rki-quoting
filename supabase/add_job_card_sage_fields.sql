-- Sage invoice tracking on job cards
ALTER TABLE elec_job_cards
  ADD COLUMN IF NOT EXISTS sage_invoice_id      text,
  ADD COLUMN IF NOT EXISTS sage_invoice_status  text,
  ADD COLUMN IF NOT EXISTS sage_pushed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS sage_customer_id     text,
  ADD COLUMN IF NOT EXISTS sage_customer_name   text;
