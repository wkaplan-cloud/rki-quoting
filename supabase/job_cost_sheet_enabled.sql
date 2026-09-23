-- Per-org override that unlocks the Job Cost Sheet on the Solo plan.
--
-- The cost sheet is normally a Studio-tier feature, gated in ProjectDetail on
-- `plan !== 'solo'`. This flag is a goodwill exception for individual Solo
-- studios: it only ever adds access, never removes it. Studio and Agency orgs
-- keep the cost sheet whether the flag is set or not.
--
-- Defaults to false, so every existing org behaves exactly as it does today.

alter table settings
  add column if not exists job_cost_sheet_enabled boolean not null default false;

comment on column settings.job_cost_sheet_enabled is
  'Solo-plan override: show the Job Cost Sheet PDF + email actions. Ignored on Studio/Agency, which always have it.';
