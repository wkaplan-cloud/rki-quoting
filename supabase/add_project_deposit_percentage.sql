-- Add per-project deposit_percentage override.
-- Falls back to settings.deposit_percentage when null.
alter table projects
  add column if not exists deposit_percentage numeric default null;
