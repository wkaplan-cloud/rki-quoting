-- Separate "Date Issued" for invoices, so the invoice date can differ from the quote date.
-- Null means the invoice falls back to quoted_date (previous behaviour).
alter table projects
  add column if not exists invoiced_date date default null;
