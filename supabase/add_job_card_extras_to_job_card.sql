-- ─── Extra work becomes a job card, not a project quote ───────────────────────
-- Extra work found on a job card is job-card work: the office prices it on a new
-- job card's job sheet, sends that card to the client to approve, and the work
-- is signed off on it. It never becomes a project quote.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table elec_job_card_extras
  add column if not exists created_job_card_id uuid references elec_job_cards(id) on delete set null;

create index if not exists idx_job_card_extras_created_card
  on elec_job_card_extras (created_job_card_id);

alter table elec_job_cards
  add column if not exists extras_from_job_card_id uuid references elec_job_cards(id) on delete set null;

create index if not exists idx_job_cards_extras_from
  on elec_job_cards (extras_from_job_card_id);

comment on column elec_job_cards.extras_from_job_card_id is
  'The job card whose extra work produced this one.';
