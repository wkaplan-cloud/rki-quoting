-- Add PDF template and colour theme selection to settings
alter table settings
  add column if not exists pdf_template    text default 'classic',
  add column if not exists pdf_color_theme text default 'warm';
