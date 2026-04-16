-- Add quoted_date to projects (locked on first PDF generation, never changes after)
alter table projects
  add column if not exists quoted_date date;

-- Add commercial fields to settings
alter table settings
  add column if not exists quote_validity_days integer default 30,
  add column if not exists payment_terms text,
  add column if not exists lead_time text;
