-- Our Pieces: shared company catalog of pieces (org-level, all team members can see/edit)
-- Run this in Supabase SQL Editor

create table if not exists pieces (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null,
  description     text,
  work_type       text,
  dimensions      text,
  colour_finish   text,
  year            integer,
  supplier_id     uuid references suppliers(id) on delete set null,
  supplier_name   text,
  base_price      numeric(12, 2),
  image_urls      text[] default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Enable RLS
alter table pieces enable row level security;

-- Everyone in the same org can read and write all pieces
create policy "Org members can manage pieces"
  on pieces for all
  using (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  )
  with check (
    org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  );

-- Optional: lets sourcing items track which piece they came from
alter table sourcing_session_items
  add column if not exists piece_id uuid references pieces(id) on delete set null;
