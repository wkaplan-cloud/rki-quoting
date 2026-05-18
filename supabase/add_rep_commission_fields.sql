-- Track rep commission payment status per organisation
alter table organizations
  add column if not exists rep_upfront_paid boolean default false,
  add column if not exists rep_monthly_last_paid_at timestamptz;
