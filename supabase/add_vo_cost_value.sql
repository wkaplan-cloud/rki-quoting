ALTER TABLE elec_variation_orders
  ADD COLUMN IF NOT EXISTS cost_value numeric(12,2);
