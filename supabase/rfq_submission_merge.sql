-- Supplier RFQ pricing: merge instead of overwrite, and keep a verbatim record.
-- Run manually in the Supabase SQL editor.
--
-- Background: a supplier submitted 14 items and every price landed as NULL.
-- Nothing in the system could say whether they had typed prices we failed to
-- read or had never typed any, because the submit endpoint deleted the whole
-- previous submission before inserting the new one and logged nothing.
--
-- 1. The unique index lets /api/rfq/[token]/submit upsert on
--    (rfq_request_id, studio_spec_id) instead of delete-then-insert, so a
--    supplier coming back to fix one price can no longer lose the rest.
--    Deliberately not partial: ON CONFLICT can only infer a partial index if
--    the statement repeats its predicate, which PostgREST can't express.
--    Quotes typed against a Piece carry a null rfq_request_id and Postgres
--    treats nulls as distinct, so those stay unconstrained anyway.
-- 2. rfq_submission_log keeps what the supplier actually sent, before parsing.

create unique index if not exists spec_quotes_rfq_spec_uniq
  on spec_quotes (rfq_request_id, studio_spec_id);

create table if not exists rfq_submission_log (
  id uuid primary key default gen_random_uuid(),
  rfq_request_id uuid references rfq_requests(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_name text,
  supplier_email text,
  -- Exactly what arrived on the wire, untouched
  raw_payload jsonb not null default '[]'::jsonb,
  -- What we made of it, item by item, including any parse error
  parsed_items jsonb not null default '[]'::jsonb,
  rejected_count int not null default 0,
  accepted_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rfq_submission_log_request_idx
  on rfq_submission_log (rfq_request_id, created_at desc);

alter table rfq_submission_log enable row level security;

drop policy if exists rfq_submission_log_org_rw on rfq_submission_log;
create policy rfq_submission_log_org_rw on rfq_submission_log
  for all using (org_id = get_current_org_id());
