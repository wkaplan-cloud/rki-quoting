-- Studio Phase 2: architecture foundation
-- Run this in Supabase SQL Editor AFTER studio.sql and studio_boards_clients.sql

-- 1. studio_assets: every image imported into a board is registered here.
--    hash = sha256 of the processed file, unique per board → duplicate
--    uploads resolve to the existing file instead of storing it twice.
create table if not exists studio_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  board_id uuid not null references studio_boards(id) on delete cascade,
  url text not null,
  hash text not null,
  natural_width integer not null default 0,
  natural_height integer not null default 0,
  file_size integer not null default 0,
  created_at timestamptz not null default now(),
  unique(board_id, hash)
);
create index if not exists studio_assets_org_idx on studio_assets(org_id);
create index if not exists studio_assets_board_idx on studio_assets(board_id, created_at desc);
alter table studio_assets enable row level security;
create policy "studio_assets_org_rw" on studio_assets
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 2. studio_slide_revisions: version-history foundation. A snapshot of a
--    slide's content is written (throttled) on autosave. No FK to
--    studio_slides so revisions survive slide deletion — a future history UI
--    can restore deleted slides from here. Board deletion cascades.
create table if not exists studio_slide_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  board_id uuid not null references studio_boards(id) on delete cascade,
  slide_id uuid not null,
  name text not null,
  heading text not null default '',
  objects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists studio_slide_revisions_slide_idx on studio_slide_revisions(slide_id, created_at desc);
create index if not exists studio_slide_revisions_board_idx on studio_slide_revisions(board_id, created_at desc);
create index if not exists studio_slide_revisions_org_idx on studio_slide_revisions(org_id);
alter table studio_slide_revisions enable row level security;
create policy "studio_slide_revisions_org_rw" on studio_slide_revisions
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 3. Master layout configuration per board (defaults applied in code;
--    no UI yet — future phases customise logo/heading/page-number display)
alter table studio_boards add column if not exists master_layout jsonb;
