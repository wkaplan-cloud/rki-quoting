-- Expand projects.status check constraint to include 'Approved' and 'Deposit'
ALTER TABLE projects DROP CONSTRAINT projects_status_check;

ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('Draft', 'Quote', 'Approved', 'Deposit', 'Invoice', 'Paid', 'Completed', 'Cancelled'));
