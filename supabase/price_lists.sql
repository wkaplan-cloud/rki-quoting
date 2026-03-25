-- ─── price_lists ──────────────────────────────────────────────────────────────
create table if not exists price_lists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  supplier_name text not null default 'Home Fabrics',
  item_count integer not null default 0,
  created_at timestamptz default now()
);
alter table price_lists enable row level security;
create policy "Users manage own price lists" on price_lists
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── price_list_items ─────────────────────────────────────────────────────────
create table if not exists price_list_items (
  id uuid primary key default uuid_generate_v4(),
  price_list_id uuid references price_lists(id) on delete cascade not null,
  brand text,
  collection text,
  design text,
  colour text,
  sku text,
  product_id text,
  price_zar numeric,
  image_url text,
  created_at timestamptz default now()
);
alter table price_list_items enable row level security;
create policy "Users manage price list items via price list" on price_list_items
  using (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.user_id = auth.uid()
    )
  );
