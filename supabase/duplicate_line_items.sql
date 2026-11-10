-- Duplicate a line item (per-org feature, first built for Elize Beltrame Interiors, Nov 2026).
-- Off by default, so other studios' line items table is unchanged.
alter table settings
  add column if not exists duplicate_line_enabled boolean not null default false;

comment on column settings.duplicate_line_enabled is
  'Platform toggle: copy icon on each line item that duplicates it directly below.';
