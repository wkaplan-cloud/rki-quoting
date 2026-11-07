-- Who a supplier's email was addressed to, read from its original To and Cc
-- headers. The delivered-to address is always the assistant's own, so it says nothing.
alter table agent_emails
  add column if not exists sent_to text[] not null default '{}',
  add column if not exists sent_cc text[] not null default '{}';
