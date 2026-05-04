ALTER TABLE sourcing_item_assignments
  ADD COLUMN IF NOT EXISTS fee_collected_at TIMESTAMPTZ DEFAULT NULL;
