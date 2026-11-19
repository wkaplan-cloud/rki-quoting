-- Undo after deleting a line item (per-org feature, first built for Elize Beltrame
-- Interiors, Nov 2026). Off by default, so other studios' delete is unchanged.
-- The line is deleted straight away; a 10-second "Undo" pop-up puts the row and
-- its links (linked sub-items, Studio specs, sourcing items, spec quotes) back.
alter table settings
  add column if not exists undo_delete_enabled boolean not null default false;

comment on column settings.undo_delete_enabled is
  'Platform toggle: 10-second Undo pop-up after deleting a line item.';

-- Locked like the other platform switches (protect_platform_switches.sql).
-- APPLIED 2026-11-19.
