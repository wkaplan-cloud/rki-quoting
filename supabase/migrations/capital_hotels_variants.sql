-- Capital Hotels: variants, fabric, dimensions, image fields
-- Run this in Supabase SQL Editor AFTER capital_hotels.sql

-- 1. Add fabric to capital_pieces (image_url already exists)
ALTER TABLE capital_pieces ADD COLUMN IF NOT EXISTS fabric text;

-- 2. New variants table (size variants per piece)
CREATE TABLE IF NOT EXISTS capital_piece_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES capital_pieces(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label text NOT NULL,           -- e.g. "Sandton", "Standard 2.2m"
  dimensions text,               -- e.g. "2200 x 900mm"
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capital_piece_variants_piece_idx ON capital_piece_variants(piece_id);
CREATE INDEX IF NOT EXISTS capital_piece_variants_org_idx ON capital_piece_variants(org_id);
ALTER TABLE capital_piece_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capital_piece_variants_org_rw" ON capital_piece_variants
  USING (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

-- 3. Add variant_id to prices (nullable — null = base piece price, set = variant price)
ALTER TABLE capital_piece_prices ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES capital_piece_variants(id) ON DELETE CASCADE;

-- Drop the old unique constraint (piece + supplier) and replace with partial indexes
ALTER TABLE capital_piece_prices DROP CONSTRAINT IF EXISTS capital_piece_prices_capital_piece_id_supplier_id_key;

-- Unique: one price per (piece, supplier) when no variant
CREATE UNIQUE INDEX IF NOT EXISTS cap_prices_piece_supplier_uniq
  ON capital_piece_prices(capital_piece_id, supplier_id)
  WHERE variant_id IS NULL;

-- Unique: one price per (variant, supplier)
CREATE UNIQUE INDEX IF NOT EXISTS cap_prices_variant_supplier_uniq
  ON capital_piece_prices(variant_id, supplier_id)
  WHERE variant_id IS NOT NULL;

-- 4. Enrich capital_request_items with everything needed for line items
ALTER TABLE capital_request_items ADD COLUMN IF NOT EXISTS capital_piece_variant_id uuid REFERENCES capital_piece_variants(id) ON DELETE SET NULL;
ALTER TABLE capital_request_items ADD COLUMN IF NOT EXISTS variant_label text;
ALTER TABLE capital_request_items ADD COLUMN IF NOT EXISTS dimensions text;
ALTER TABLE capital_request_items ADD COLUMN IF NOT EXISTS fabric text;
ALTER TABLE capital_request_items ADD COLUMN IF NOT EXISTS piece_image_url text;
