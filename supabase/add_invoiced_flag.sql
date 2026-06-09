-- Add manual invoiced flag to completed projects and job cards
alter table elec_quotes     add column if not exists invoiced boolean default false;
alter table elec_job_cards  add column if not exists invoiced boolean default false;
