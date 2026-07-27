-- RFQ requests: the persisted record of a quote-request email sent to one
-- supplier, and the credential (token) behind the self-serve pricing link in
-- that email. One row per recipient email — the same board can spawn many.
--
-- Without this, an RFQ send was fire-and-forget (it only stamped rfq_sent_at
-- on the specs). This table lets a supplier open a link and submit pricing
-- per item, which lands in spec_quotes with source:'link'. Run in Supabase
-- SQL Editor.
create table if not exists rfq_requests (
  id uuid primary key default gen_random_uuid(),
  -- Opaque, unguessable credential in the email link. The only thing the
  -- public page authenticates against — no login.
  token text not null unique,
  org_id uuid not null references organizations(id) on delete cascade,
  board_id uuid not null references studio_boards(id) on delete cascade,
  -- The supplier this link was sent to. supplier_id is null for ad-hoc
  -- comparison recipients typed in at send time (no supplier record).
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text not null default '',
  supplier_email text not null default '',
  -- The exact spec objects this supplier was asked to price — the link only
  -- ever exposes these, never anything else on the board.
  object_ids uuid[] not null default '{}',
  -- The designer's covering message from the send modal (shown for context).
  message text not null default '',
  created_by uuid,          -- auth user who sent it (notify fallback)
  created_by_email text,    -- reply-to / notify target
  expires_at timestamptz not null,
  submitted_at timestamptz, -- last time the supplier submitted (overwrite model)
  submission_message text not null default '', -- supplier's overall note
  created_at timestamptz not null default now()
);
create index if not exists rfq_requests_token_idx on rfq_requests(token);
create index if not exists rfq_requests_org_idx on rfq_requests(org_id);
create index if not exists rfq_requests_board_idx on rfq_requests(board_id);

alter table rfq_requests enable row level security;

-- The authenticated designer creates and reads their org's RFQ requests
-- (the send route runs as them). The public supplier has no Supabase session,
-- so their submission is applied via supabaseAdmin (service role bypasses
-- RLS) — there is deliberately no public update policy here.
create policy "rfq_requests_org_read" on rfq_requests
  for select using (org_id = get_current_org_id());
create policy "rfq_requests_org_insert" on rfq_requests
  for insert with check (org_id = get_current_org_id());
