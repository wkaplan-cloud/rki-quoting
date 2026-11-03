-- Studio assistant inbox (per-org feature, first built for R Kaplan Interiors).
--
-- The studio gives the assistant its own Gmail account and forwards supplier
-- mail to it. Every few minutes a cron reads new mail over IMAP, Claude reads
-- the email and any PDF, and the result is filed here: what kind of document
-- it is, which supplier sent it, which project or RFQ it belongs to, and what
-- the studio needs to do about it.
--
-- Nothing here writes to projects, line items or spec_quotes. Supplier prices
-- still arrive only through the RFQ link; the assistant files and flags.
--
-- Off by default; switched on per studio from Platform → Studios → Feature
-- Toggles. Studios with the switch off see exactly what they did before.

alter table settings
  add column if not exists agent_enabled boolean not null default false;

comment on column settings.agent_enabled is
  'Platform toggle: studio assistant reads a forwarded Gmail inbox and files supplier mail and PDFs.';

-- One mailbox per studio. The app password is stored encrypted (lib/sage-crypto)
-- and this table has no client policies: only the service role reads it.
create table if not exists agent_mailboxes (
  org_id           uuid primary key references organizations(id) on delete cascade,
  agent_name       text not null default 'Mia',
  email            text not null,
  app_password_enc text not null,
  last_uid         bigint,
  uid_validity     bigint,
  last_checked_at  timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table agent_mailboxes enable row level security;

create table if not exists agent_emails (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  message_id       text not null,
  imap_uid         bigint,
  from_email       text,
  from_name        text,
  subject          text,
  received_at      timestamptz,
  body_text        text,
  -- What the assistant decided
  kind             text,          -- supplier_quote | proforma | invoice | order_confirmation | delivery | stock_or_lead_time | price_list | rfq_reply | other | not_supplier
  supplier_id      uuid references suppliers(id) on delete set null,
  supplier_guess   text,          -- supplier name as written, when no supplier row matched
  project_id       uuid references projects(id) on delete set null,
  rfq_request_id   uuid references rfq_requests(id) on delete set null,
  match_confidence text,          -- high | medium | low
  match_reason     text,
  summary          text,
  action_needed    text,          -- null when nothing needs a person
  status           text not null default 'new',   -- new | done | error
  error            text,
  model            text,
  filed_by         uuid,          -- set when a person changed the filing
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, message_id)
);

create index if not exists agent_emails_org_idx on agent_emails (org_id, received_at desc);
create index if not exists agent_emails_project_idx on agent_emails (project_id);

alter table agent_emails enable row level security;

drop policy if exists "Org members read agent emails" on agent_emails;
create policy "Org members read agent emails" on agent_emails
  for select using (org_id = get_current_org_id());

drop policy if exists "Org members update agent emails" on agent_emails;
create policy "Org members update agent emails" on agent_emails
  for update using (org_id = get_current_org_id()) with check (org_id = get_current_org_id());

create table if not exists agent_documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  email_id      uuid not null references agent_emails(id) on delete cascade,
  filename      text not null,
  content_type  text,
  size_bytes    integer,
  storage_path  text,
  doc_type      text,
  extracted     jsonb,          -- supplier, reference, dates, totals, line items as read from the PDF
  read_error    text,           -- set when the PDF arrived but could not be read
  created_at    timestamptz not null default now()
);

create index if not exists agent_documents_email_idx on agent_documents (email_id);

alter table agent_documents enable row level security;

drop policy if exists "Org members read agent documents" on agent_documents;
create policy "Org members read agent documents" on agent_documents
  for select using (org_id = get_current_org_id());

-- Private bucket; files are served through signed URLs from an API route.
insert into storage.buckets (id, name, public)
values ('agent-documents', 'agent-documents', false)
on conflict (id) do nothing;
