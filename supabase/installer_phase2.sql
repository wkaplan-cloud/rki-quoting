-- Installer portal — phase 2 (2026-09-24): device register + programming hours
--
-- Additive only. Electricians never touch these.

-- Every device an installer leaves on a site: what it is, where it is, how to
-- reach it, and when its warranty ends. Owned by the client (the site), and
-- linked to the project it went in on when there was one.
create table if not exists elec_devices (
  id                 uuid primary key default gen_random_uuid(),
  portal_account_id  uuid not null references supplier_portal_accounts(id) on delete cascade,
  client_id          uuid references elec_clients(id) on delete set null,
  quote_id           uuid references elec_quotes(id) on delete set null,
  room               text,
  category           text,
  brand              text,
  model              text,
  description        text,
  serial_number      text,
  mac_address        text,
  ip_address         text,
  firmware           text,
  installed_on       date,
  warranty_until     date,
  -- Device login. The password is AES-256-GCM ciphertext (lib/sage-crypto.ts),
  -- only ever decrypted on an explicit reveal.
  username           text,
  password_encrypted text,
  notes              text,
  created_by_name    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists elec_devices_account_idx on elec_devices (portal_account_id);
create index if not exists elec_devices_client_idx  on elec_devices (client_id);
create index if not exists elec_devices_quote_idx   on elec_devices (quote_id);
create index if not exists elec_devices_serial_idx  on elec_devices (portal_account_id, lower(serial_number));
create index if not exists elec_devices_mac_idx     on elec_devices (portal_account_id, lower(mac_address));

-- Service-role only, like kits: every route filters by portal_account_id.
alter table elec_devices enable row level security;

-- Programming time, told apart from install time. Set on a clock-in to a job
-- card; null on everything that existed before, which reads as install.
alter table elec_time_punches
  add column if not exists work_type text;

do $$ begin
  alter table elec_time_punches
    add constraint elec_time_punches_work_type_check
    check (work_type is null or work_type in ('install', 'programming'));
exception when duplicate_object then null; end $$;
