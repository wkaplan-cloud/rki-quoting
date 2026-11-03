-- Studio assistant: what reading supplier mail costs, and when the Claude
-- account has run out of credit.
--
-- One row per model call (a "Read again" is a second call and costs again).
-- Cost is worked out when the call is made, from the tokens the API reports
-- and the model's list price, so a later price change doesn't rewrite history.

create table if not exists agent_usage (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  email_id           uuid references agent_emails(id) on delete set null,
  model              text not null,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd           numeric(10,5) not null,
  created_at         timestamptz not null default now()
);

create index if not exists agent_usage_org_idx on agent_usage (org_id, created_at desc);

alter table agent_usage enable row level security;

drop policy if exists "Org members read agent usage" on agent_usage;
create policy "Org members read agent usage" on agent_usage
  for select using (org_id = get_current_org_id());

-- Set when the API refuses a read for lack of credit; cleared by the next
-- read that succeeds.
alter table agent_mailboxes add column if not exists credit_out_at timestamptz;
