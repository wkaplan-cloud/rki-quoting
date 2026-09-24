-- Installer portal — phase 1 (2026-09-24)
--
-- Installers (home automation, CCTV, AV, networking) run on the trades portal
-- with a different trade_type. Everything here is additive: electricians keep
-- every default, and no existing row changes meaning.

-- Which trade a trades account is. Drives the green theme, hides the COC
-- engine, and switches on catalogue import and kits.
alter table supplier_portal_accounts
  add column if not exists trade_type text not null default 'electrician';

do $$ begin
  alter table supplier_portal_accounts
    add constraint supplier_portal_accounts_trade_type_check
    check (trade_type in ('electrician', 'installer'));
exception when duplicate_object then null; end $$;

-- Catalogue fields for distributor price-list imports. sku is the match key on
-- re-import, so a new price list updates the item instead of duplicating it.
alter table elec_item_library
  add column if not exists sku text,
  add column if not exists brand text,
  add column if not exists supplier_name text;

create unique index if not exists elec_item_library_account_sku_key
  on elec_item_library (portal_account_id, lower(sku))
  where sku is not null;

-- Kits: a named bundle of lines ("4-camera CCTV", "Cinema room") that expands
-- into a quote section in one click. Lines are snapshots, not links, so a kit
-- keeps its pricing when a catalogue item is later re-imported or deleted.
create table if not exists elec_kits (
  id                uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null references supplier_portal_accounts(id) on delete cascade,
  name              text not null,
  description       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists elec_kits_account_idx on elec_kits (portal_account_id);

create table if not exists elec_kit_items (
  id                uuid primary key default gen_random_uuid(),
  kit_id            uuid not null references elec_kits(id) on delete cascade,
  description       text not null,
  unit              text not null default 'nr',
  quantity          numeric not null default 1,
  cost_unit_rate    numeric,
  markup_percentage numeric,
  quoted_unit_rate  numeric not null default 0,
  labour_rate       numeric,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists elec_kit_items_kit_idx on elec_kit_items (kit_id);

-- Kits are only read and written through API routes on the service role, which
-- filter by portal_account_id. RLS on with no policies keeps the anon and
-- authenticated keys out entirely.
alter table elec_kits      enable row level security;
alter table elec_kit_items enable row level security;

-- Optional lines: priced on the quote but left out of its total until the
-- client ticks them. On approval, ticked lines become ordinary lines and
-- unticked ones are removed, so claims and as-built never see an optional.
alter table elec_quote_line_items
  add column if not exists is_optional boolean not null default false,
  add column if not exists optional_selected boolean not null default false;

-- Deposit taken on acceptance, as a % of the contract. Approval raises it as a
-- draft claim at this % on every line, so later progress claims carry on from it.
alter table elec_quotes
  add column if not exists deposit_percentage numeric not null default 0;

alter table elec_settings
  add column if not exists default_deposit_percentage numeric not null default 0;
