-- Add assigned_to to projects for team handoff support
alter table projects add column if not exists assigned_to uuid references auth.users(id) on delete set null;
