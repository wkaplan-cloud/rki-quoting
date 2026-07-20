-- Studio ↔ Pieces catalog link. Run in Supabase SQL Editor.
--
-- Lets a canvas spec originate from a catalog Piece: item_specs carries the
-- category-specific fields (same shape as pieces.item_specs), piece_id is a
-- soft backreference for the "linked to catalog" UI. Placement SNAPSHOTS the
-- piece's data onto the spec — this column is not kept in sync afterwards,
-- so editing a spec on one board never touches the shared catalog record.
alter table studio_specs add column if not exists piece_id uuid references pieces(id) on delete set null;
alter table studio_specs add column if not exists item_specs jsonb not null default '{}'::jsonb;
