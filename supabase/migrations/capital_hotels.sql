-- Capital Hotels System
-- Run this in Supabase SQL Editor

-- 1. capital_pieces (must exist before capital_request_items FK)
create table if not exists capital_pieces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'general',
  image_url text,
  created_at timestamptz not null default now()
);
create index if not exists capital_pieces_org_idx on capital_pieces(org_id);
alter table capital_pieces enable row level security;
create policy "capital_pieces_org_rw" on capital_pieces
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 2. capital_piece_prices
create table if not exists capital_piece_prices (
  id uuid primary key default gen_random_uuid(),
  capital_piece_id uuid not null references capital_pieces(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  supplier_name text not null,
  cost_price numeric(10,2) not null,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(capital_piece_id, supplier_id)
);
create index if not exists capital_piece_prices_org_idx on capital_piece_prices(org_id);
create index if not exists capital_piece_prices_piece_idx on capital_piece_prices(capital_piece_id);
alter table capital_piece_prices enable row level security;
create policy "capital_piece_prices_org_rw" on capital_piece_prices
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 3. capital_hotels
create table if not exists capital_hotels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists capital_hotels_org_idx on capital_hotels(org_id);
alter table capital_hotels enable row level security;
create policy "capital_hotels_org_rw" on capital_hotels
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 4. capital_requests
create table if not exists capital_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  hotel_id uuid not null references capital_hotels(id) on delete cascade,
  hotel_name text not null,
  status text not null default 'pending', -- pending | in_progress | quoted
  notes text,
  quote_project_id uuid references projects(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists capital_requests_org_idx on capital_requests(org_id);
create index if not exists capital_requests_status_idx on capital_requests(org_id, status);
alter table capital_requests enable row level security;
create policy "capital_requests_org_rw" on capital_requests
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 5. capital_request_items
create table if not exists capital_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references capital_requests(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  image_url text,
  description text not null,
  quantity integer not null default 1,
  capital_piece_id uuid references capital_pieces(id) on delete set null,
  piece_name text,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text,
  cost_price numeric(10,2),
  markup_percentage numeric(5,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists capital_request_items_org_idx on capital_request_items(org_id);
create index if not exists capital_request_items_request_idx on capital_request_items(request_id);
alter table capital_request_items enable row level security;
create policy "capital_request_items_org_rw" on capital_request_items
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());

-- 6. Settings columns
alter table settings add column if not exists capital_hotels_enabled boolean not null default false;
alter table settings add column if not exists capital_hotel_email text;

-- NOTE: After running this migration, also:
-- 1. Create a Supabase Storage bucket named "capital-hotel-images" and set it to PUBLIC
-- 2. Add CAPITAL_HOTEL_ORG_ID=<rki-org-id> to .env.local
-- 3. Run: UPDATE settings SET capital_hotels_enabled = true WHERE org_id = '<rki-org-id>';
-- 4. Optionally: UPDATE settings SET capital_hotel_email = 'design@rkaplaninteriors.co.za' WHERE org_id = '<rki-org-id>';
