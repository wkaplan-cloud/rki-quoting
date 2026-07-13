-- Studio Module (presentation boards)
-- Run this in Supabase SQL Editor

-- 1. studio_boards: one presentation board per project
create table if not exists studio_boards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null default 'Presentation',
  last_state jsonb, -- resume state: { slideId, zoom, panX, panY }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists studio_boards_project_uniq on studio_boards(project_id);
create index if not exists studio_boards_org_idx on studio_boards(org_id);
alter table studio_boards enable row level security;
create policy "studio_boards_org_rw" on studio_boards
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 2. studio_slides: canvas objects stored as a JSONB array (z-order = array index)
create table if not exists studio_slides (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references studio_boards(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  heading text not null default '',
  sort_order integer not null default 0,
  objects jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists studio_slides_org_idx on studio_slides(org_id);
create index if not exists studio_slides_board_idx on studio_slides(board_id, sort_order);
alter table studio_slides enable row level security;
create policy "studio_slides_org_rw" on studio_slides
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 3. Settings column
alter table settings add column if not exists studio_enabled boolean not null default false;

-- NOTE: After running this migration, also:
-- 1. Create a Supabase Storage bucket named "studio-images" and set it to PUBLIC
-- 2. Run: UPDATE settings SET studio_enabled = true WHERE org_id = '<pilot-org-id>';
