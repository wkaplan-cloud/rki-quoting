-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── clients ─────────────────────────────────────────────────────────────────
create table clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_name text not null,
  company text,
  vat_number text,
  contact_number text,
  address text,
  created_at timestamptz default now()
);
alter table clients enable row level security;
create policy "Users manage own clients" on clients
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── suppliers ───────────────────────────────────────────────────────────────
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  supplier_name text not null,
  category text,
  contact_person text,
  contact_number text,
  rep_name text,
  rep_number text,
  email text,
  delivery_address text,
  markup_percentage numeric default 40,
  created_at timestamptz default now()
);
alter table suppliers enable row level security;
create policy "Users manage own suppliers" on suppliers
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── items ───────────────────────────────────────────────────────────────────
create table items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_name text not null,
  created_at timestamptz default now()
);
alter table items enable row level security;
create policy "Users manage own items" on items
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── projects ────────────────────────────────────────────────────────────────
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_number text not null,
  project_name text not null,
  client_id uuid references clients(id) on delete set null,
  date date not null default current_date,
  status text not null default 'Quote',
  design_fee numeric not null default 0,
  notes text,
  created_at timestamptz default now(),
  constraint projects_status_check check (status in ('Quote','Invoice','Completed','Cancelled'))
);
alter table projects enable row level security;
create policy "Users manage own projects" on projects
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── line_items ──────────────────────────────────────────────────────────────
create table line_items (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  item_name text not null default '',
  description text,
  quantity numeric not null default 1,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_name text,
  delivery numeric not null default 0,
  cost_price numeric not null default 0,
  markup_percentage numeric not null default 40,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);
alter table line_items enable row level security;
-- Access via project ownership
create policy "Users manage line items via project" on line_items
  using (
    exists (
      select 1 from projects p where p.id = line_items.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p where p.id = line_items.project_id and p.user_id = auth.uid()
    )
  );

-- ─── settings (per-user config) ──────────────────────────────────────────────
create table settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  business_name text default 'R Kaplan Interiors',
  logo_url text,
  email_from text default 'quotes@rkaplaninteriors.co.za',
  vat_rate numeric default 15,
  deposit_percentage numeric default 70,
  footer_text text default 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.',
  created_at timestamptz default now()
);
alter table settings enable row level security;
create policy "Users manage own settings" on settings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
