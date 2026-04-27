-- Our Pieces: designer catalog of pieces with images, specs, supplier, and reference pricing
-- Run this in Supabase SQL Editor

create table if not exists pieces (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade not null,
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

-- Policy: users can manage pieces that belong to their org
create policy "Users can manage their org pieces"
  on pieces for all
  using (
    org_id in (
      select org_id from settings where user_id = auth.uid()
    )
  );

-- Optional: allow sourcing_session_items to reference a piece
-- (tracks which sourcing items were created from a piece — for future "update piece price" prompt)
alter table sourcing_session_items
  add column if not exists piece_id uuid references pieces(id) on delete set null;
