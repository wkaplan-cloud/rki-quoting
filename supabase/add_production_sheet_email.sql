-- Add production sheet recipient email to studio settings
alter table settings
  add column if not exists production_sheet_email text;
