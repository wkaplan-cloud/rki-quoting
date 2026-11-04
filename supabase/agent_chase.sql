-- Studio assistant: the "To chase" list. Quotes about to expire and RFQs with
-- no reply are worked out from the source rows each time; these only record
-- that a person has dealt with one, so it stops being listed.

alter table agent_documents add column if not exists chase_done_at timestamptz;
alter table rfq_requests    add column if not exists chase_done_at timestamptz;
