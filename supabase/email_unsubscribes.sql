-- Suppression list for marketing / broadcast email.
-- Transactional mail (password resets, quotes, invoices) is NOT filtered by
-- this table — recipients cannot opt out of mail they asked us to send.

create table if not exists email_unsubscribes (
  email        text primary key,
  source       text,                                   -- 'one-click' | 'link' | 'manual' | 'complaint'
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists email_unsubscribes_created_at_idx
  on email_unsubscribes (created_at desc);

alter table email_unsubscribes enable row level security;

-- No client-side policies: this table is written only by the service role via
-- the /api/unsubscribe route, and read only by the broadcast sender.
