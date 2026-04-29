-- Add ref_image_urls column to sourcing_session_items.
-- Stores public Supabase Storage URLs for reference images uploaded by the designer.
-- Run in Supabase SQL editor.

ALTER TABLE sourcing_session_items
  ADD COLUMN IF NOT EXISTS ref_image_urls text[];
