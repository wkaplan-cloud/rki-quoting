-- Studio specs: scatter cushions + extra item images
-- Run this in the Supabase SQL Editor.
--
-- scatters: [{ id, supplierId, supplierName, fabric, twinbruProductId, colour,
--              imageUrl, widthCm, size, quantity, details }]
--   A scatter is its own quotable thing — own supplier, own fabric, own size
--   and quantity — so it can't live inside `materials`, which describes the
--   makeup of the piece itself.
--
-- images: [{ id, url, naturalWidth, naturalHeight, caption }]
--   Extra reference images for the SAME item (back view, detail shot, drawing).
--   They never render on the moodboard; they travel with the spec to the
--   supplier alongside the board image.
alter table studio_specs
  add column if not exists scatters jsonb not null default '[]'::jsonb,
  add column if not exists images   jsonb not null default '[]'::jsonb;
