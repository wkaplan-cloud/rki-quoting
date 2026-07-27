-- Link spec_quotes to the RFQ that produced them, and let a supplier mark an
-- item they can't price. Additive to the existing spec_quotes table
-- (lead_time already exists). Run in Supabase SQL Editor.

-- Which RFQ request a link-submitted quote came from. null for source:'manual'
-- rows (typed in by the designer). Nulled if the request is later removed —
-- the logged price stays. A resubmit deletes this request's prior rows and
-- reinserts, so there's one current quote per supplier per RFQ.
alter table spec_quotes
  add column if not exists rfq_request_id uuid references rfq_requests(id) on delete set null;

-- Supplier explicitly declined to quote this item (price stays null but this
-- distinguishes "can't quote" from "not yet answered").
alter table spec_quotes
  add column if not exists unable_to_quote boolean not null default false;

create index if not exists spec_quotes_rfq_request_idx on spec_quotes(rfq_request_id);
