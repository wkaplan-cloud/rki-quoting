-- Spec quotes: a place to record what a supplier quoted, whether that
-- reply came in by email (logged manually) or — later — through a
-- self-serve link. Run in Supabase SQL Editor.
--
-- Deliberately NOT built on sourcing_sessions/sourcing_session_items — no
-- assignment state, no accept/decline workflow, no messaging thread. Just
-- "who quoted what, and when." One row per (item × supplier reply).
create table if not exists spec_quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  studio_spec_id uuid references studio_specs(id) on delete cascade,
  piece_id uuid references pieces(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text not null default '',
  price numeric(12, 2),
  lead_time text not null default '',
  notes text not null default '',
  -- 'manual': typed in by the designer after reading an email reply.
  -- 'link': submitted by the supplier through a self-serve link (future).
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint spec_quotes_target_check check (studio_spec_id is not null or piece_id is not null)
);
create index if not exists spec_quotes_org_idx on spec_quotes(org_id);
create index if not exists spec_quotes_studio_spec_idx on spec_quotes(studio_spec_id);
create index if not exists spec_quotes_piece_idx on spec_quotes(piece_id);
alter table spec_quotes enable row level security;
create policy "spec_quotes_org_rw" on spec_quotes
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());
