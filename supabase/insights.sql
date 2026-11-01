-- Insights tab on Admin (per-org feature, first built for R Kaplan Interiors).
--
-- Read-only report + clean-up list worked out from existing projects and line
-- items. Nothing here writes to project data. Off by default; switched on per
-- studio from Platform → Studios → Feature Toggles.

alter table settings
  add column if not exists insights_enabled boolean not null default false;

comment on column settings.insights_enabled is
  'Platform toggle: Admin → Insights tab (profit report + data clean-up list).';
