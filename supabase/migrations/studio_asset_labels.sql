-- Studio asset naming. Run in Supabase SQL Editor.
--
-- A short, designer-chosen name per image asset (e.g. "Sofa", "Oak wood",
-- "Sage green paint") — picked from a dropdown of names already used across
-- the org where possible, so vocabulary stays consistent and searchable,
-- rather than free text or filenames. Optional: unnamed assets just don't
-- turn up in the cross-board search yet.
alter table studio_assets add column if not exists label text;
create index if not exists studio_assets_label_idx on studio_assets(org_id, label);
