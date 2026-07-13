-- Studio Phase 3: Specs Engine
-- Run this in Supabase SQL Editor AFTER studio_phase2.sql

-- One spec record per canvas object. Org → board → slide → object.
-- object_id / slide_id have no FK (objects live inside studio_slides.objects
-- JSONB, and undo can restore deleted slides/objects); the client keeps spec
-- rows in sync with object lifecycle, and board deletion cascades everything.
--
-- Future-architecture links (relationships only, features come later):
--   line_item_id → quote line items    (FK to existing line_items)
--   product_id   → product library     (no FK yet — table doesn't exist)
create table if not exists studio_specs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  board_id uuid not null references studio_boards(id) on delete cascade,
  slide_id uuid not null,
  object_id uuid not null,
  spec_name text not null default '',
  description text not null default '',
  notes text not null default '',
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text not null default '',
  category text not null default '',
  quantity text not null default '',
  unit text not null default '',
  width text not null default '',
  depth text not null default '',
  height text not null default '',
  materials jsonb not null default '[]'::jsonb, -- [{ id, type, description }]
  status text not null default 'draft', -- draft | approved
  line_item_id uuid references line_items(id) on delete set null,
  product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(object_id)
);
create index if not exists studio_specs_org_idx on studio_specs(org_id);
create index if not exists studio_specs_board_idx on studio_specs(board_id);
create index if not exists studio_specs_slide_idx on studio_specs(slide_id);
alter table studio_specs enable row level security;
create policy "studio_specs_org_rw" on studio_specs
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());
