-- capital_piece_hotels: many-to-many between capital_pieces and capital_hotels
-- Run this in Supabase SQL Editor after capital_hotels.sql

create table if not exists capital_piece_hotels (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references capital_pieces(id) on delete cascade,
  hotel_id uuid not null references capital_hotels(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(piece_id, hotel_id)
);

create index if not exists capital_piece_hotels_piece_idx on capital_piece_hotels(piece_id);
create index if not exists capital_piece_hotels_hotel_idx on capital_piece_hotels(hotel_id);
create index if not exists capital_piece_hotels_org_idx on capital_piece_hotels(org_id);

alter table capital_piece_hotels enable row level security;
create policy "capital_piece_hotels_org_rw" on capital_piece_hotels
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());
