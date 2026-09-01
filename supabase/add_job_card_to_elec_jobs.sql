-- Link scheduled calendar jobs to a job card
-- Previously the schedule modal let you "schedule from" a job card, but the
-- selection was only used to autofill title/address/staff — nothing was stored.
-- elec_jobs already links to elec_quotes via quote_id; this adds the equivalent
-- link to elec_job_cards so a scheduled job always points back at real work.

alter table elec_jobs
  add column if not exists job_card_id uuid references elec_job_cards(id) on delete set null;

create index if not exists idx_elec_jobs_job_card on elec_jobs(job_card_id);
