-- Per-org switch for the Projects section (long-term, quote-driven work).
--
-- Projects is currently shown to every org on the Business tier, whether or not
-- they use it. Contractors who only run day-work job cards get a nav item they
-- never open. Default true so nothing changes for anyone already using it —
-- switch it off per org in Settings.
--
-- Run by hand against the project, as with the rest of supabase/.

alter table elec_settings
  add column if not exists projects_enabled boolean not null default true;

comment on column elec_settings.projects_enabled is
  'When false, the Projects section is hidden from this org''s navigation.';
