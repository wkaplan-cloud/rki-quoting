-- Add workshop overhead rate to manufacturer settings.
-- Workshop overhead rate (R/hour) = total monthly fixed costs ÷ productive hours/month.
-- Used as a cost line on quotes to ensure overheads are recovered on every job.

alter table mfg_settings
  add column if not exists overhead_rate_per_hour numeric;
