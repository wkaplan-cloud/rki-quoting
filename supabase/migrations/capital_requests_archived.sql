-- Soft-delete support for capital_requests
-- Run in Supabase SQL Editor

alter table capital_requests
  add column if not exists archived boolean not null default false;

create index if not exists capital_requests_archived_idx on capital_requests(archived);
