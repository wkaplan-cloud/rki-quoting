-- Rename the staff-created 'inspection' job_type to 'coc' (dedicated COC job
-- type, selectable from any job-card creation flow) and backfill any rows
-- already created under the old value. Constraint must allow 'coc' BEFORE
-- the backfill UPDATE runs, or the UPDATE violates the still-active old
-- constraint (it did — swap this order and it breaks again).
alter table elec_job_cards drop constraint elec_job_cards_job_type_check;
alter table elec_job_cards add constraint elec_job_cards_job_type_check
  check (job_type in ('maintenance','repair','once_off','callout','coc','inspection'));

update elec_job_cards set job_type = 'coc' where job_type = 'inspection';

alter table elec_job_cards drop constraint elec_job_cards_job_type_check;
alter table elec_job_cards add constraint elec_job_cards_job_type_check
  check (job_type in ('maintenance','repair','once_off','callout','coc'));

-- Repeatable "discoveries" line items for the COC report section, shown
-- between Declarations and Photos on every COC surface (main COC list,
-- job-card COC tab, project COC tab, staff mobile inspection).
alter table elec_coc add column if not exists report_items jsonb not null default '[]'::jsonb;
