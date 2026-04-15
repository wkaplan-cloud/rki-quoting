-- Add 'Draft' and 'Paid' to the projects status check constraint
alter table projects
  drop constraint projects_status_check;

alter table projects
  add constraint projects_status_check
  check (status in ('Draft', 'Quote', 'Invoice', 'Paid', 'Completed', 'Cancelled'));
