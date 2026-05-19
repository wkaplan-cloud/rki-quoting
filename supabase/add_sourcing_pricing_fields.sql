-- ─── Sourcing: delivery fee, installation, and VAT exempt fields ─────────────
-- Run in Supabase SQL editor.

-- Per-item: installation included/cost + VAT exempt
ALTER TABLE sourcing_item_responses
  ADD COLUMN IF NOT EXISTS installation_included boolean,
  ADD COLUMN IF NOT EXISTS installation_cost     numeric,
  ADD COLUMN IF NOT EXISTS vat_exempt            boolean NOT NULL DEFAULT false;

-- Session-level: one delivery fee covering all items from this supplier
ALTER TABLE sourcing_session_suppliers
  ADD COLUMN IF NOT EXISTS delivery_fee numeric;
