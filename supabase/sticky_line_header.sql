-- Pinned column headings on the line items table (per-org feature, first built for
-- Elize Beltrame Interiors, Nov 2026). Off by default, so other studios' table is unchanged.
alter table settings
  add column if not exists sticky_line_header_enabled boolean not null default false;

comment on column settings.sticky_line_header_enabled is
  'Platform toggle: line items table scrolls in its own box so the column headings stay visible.';
