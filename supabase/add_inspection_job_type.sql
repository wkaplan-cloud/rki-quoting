-- Allow 'inspection' as a job_type so staff can create standalone COC inspections
-- from the mobile app (see StaffInspection / inspection/[id] route).

alter table elec_job_cards drop constraint elec_job_cards_job_type_check;
alter table elec_job_cards add constraint elec_job_cards_job_type_check
  check (job_type in ('maintenance','repair','once_off','callout','inspection'));
