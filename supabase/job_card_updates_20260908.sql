-- Job card round of 2026-09-08:
--   1. 'emergency' as a job type
--   2. an optional reference image on the work description
--   3. an org switch for whether job cards may be emailed to clients at all
-- Run by hand against the project, as with the rest of supabase/.

-- 1 ── Emergency job type ────────────────────────────────────────────────────
alter table elec_job_cards drop constraint if exists elec_job_cards_job_type_check;
alter table elec_job_cards add constraint elec_job_cards_job_type_check
  check (job_type in ('maintenance','repair','once_off','callout','coc','emergency'));

-- 2 ── Reference image on the work description ───────────────────────────────
-- One image, not a gallery: the drawing or photo the scope was written from.
-- Stored in the same job-card-photos bucket, kept off the Photos tab the way
-- the signature already is.
alter table elec_job_cards
  add column if not exists work_description_image_url text;

comment on column elec_job_cards.work_description_image_url is
  'Optional reference image for the work description — excluded from the Photos gallery.';

-- 3 ── Client sending switch ─────────────────────────────────────────────────
-- Some electricians want job cards to reach the office only, never the client.
-- Default true so nothing changes for orgs already sending to clients.
alter table elec_settings
  add column if not exists job_card_client_send_enabled boolean not null default true;

comment on column elec_settings.job_card_client_send_enabled is
  'When false, job card emails go to the org addresses only — the client is never a recipient.';
