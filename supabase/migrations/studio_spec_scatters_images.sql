-- Studio specs: scatter cushions + extra item images
-- Run this in the Supabase SQL Editor.
--
-- scatters: [{ id, supplierId, supplierName, size, quantity, details,
--              fabrics: [{ id, label, fabricSupplierId, fabricSupplierName,
--                          fabricQuantity, fabric, twinbruProductId, colour,
--                          imageUrl, widthCm }] }]
--   A scatter is its own quotable thing — own supplier, own fabrics, own size
--   and quantity — so it can't live inside `materials`, which describes the
--   makeup of the piece itself. It takes as many fabrics as it needs (a face,
--   a contrast back, a piping), each labelled with the scatter detail it
--   covers and each ordered on its own line.
--   Scatters saved before `fabrics` existed still carry the old flat fabric
--   fields; normalizeScatter() folds those into fabrics[0] on read, so no
--   backfill of this column is needed.
--
-- images: [{ id, url, naturalWidth, naturalHeight, caption }]
--   Extra reference images for the SAME item (back view, detail shot, drawing).
--   They never render on the moodboard; they travel with the spec to the
--   supplier alongside the board image.
alter table studio_specs
  add column if not exists scatters jsonb not null default '[]'::jsonb,
  add column if not exists images   jsonb not null default '[]'::jsonb;
