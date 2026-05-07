-- Store the actual deposit amount received (from Sage sync).
-- Null means no Sage deposit detected yet; falls back to percentage-based display.
alter table projects
  add column if not exists deposit_amount_received numeric default null;
