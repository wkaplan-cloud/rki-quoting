ALTER TABLE elec_variation_orders
  ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_notes text;

-- Backfill share_token for any existing rows that have null
UPDATE elec_variation_orders SET share_token = gen_random_uuid() WHERE share_token IS NULL;
