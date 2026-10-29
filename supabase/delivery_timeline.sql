-- Delivery timeline (per-org feature, first built for Elize Beltrame Interiors).
--
-- Everything here is additive and empty by default, so studios without the
-- `delivery_timeline_enabled` flag see and print exactly what they did before.
--
-- A line item's expected delivery is its own `delivery_date` if set, otherwise
-- the date set for its supplier on that project (project_supplier_deliveries).

alter table settings
  add column if not exists delivery_timeline_enabled boolean not null default false;

comment on column settings.delivery_timeline_enabled is
  'Platform toggle: line item status + delivery dates, project install deadline, and the /timeline page.';

alter table line_items
  add column if not exists delivery_date date;

-- An `order_status` column was briefly added alongside this and is unused
-- (the client chose the existing received tick instead). Drop it from the
-- Supabase SQL editor — the MCP refuses destructive statements:
--   alter table line_items drop column if exists order_status;

comment on column line_items.delivery_date is
  'Per-item override of the supplier delivery date for this project. Null = use the supplier date.';

alter table projects
  add column if not exists install_deadline date;

create table if not exists project_supplier_deliveries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  project_id    uuid not null references projects(id) on delete cascade,
  supplier_name text not null,
  delivery_date date,
  created_at    timestamptz not null default now(),
  unique (project_id, supplier_name)
);

create index if not exists project_supplier_deliveries_org_idx
  on project_supplier_deliveries (org_id);

alter table project_supplier_deliveries enable row level security;

drop policy if exists "Org members manage supplier deliveries" on project_supplier_deliveries;
create policy "Org members manage supplier deliveries" on project_supplier_deliveries
  for all
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());
