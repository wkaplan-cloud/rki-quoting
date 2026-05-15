-- Add sales rep assignment to organizations
alter table organizations
  add column if not exists assigned_rep text;
