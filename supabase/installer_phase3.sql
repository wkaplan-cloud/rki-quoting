-- Installer portal — phase 3 (2026-09-24): service contracts + recurring invoices
--
-- Additive only. Electricians never touch these.

-- A support plan sold to a client: what it costs, how often it bills, what it
-- covers, and when it renews.
create table if not exists elec_service_contracts (
  id                        uuid primary key default gen_random_uuid(),
  portal_account_id         uuid not null references supplier_portal_accounts(id) on delete cascade,
  client_id                 uuid not null references elec_clients(id) on delete cascade,
  name                      text not null,
  billing_period            text not null default 'monthly',
  -- Per billing period, ex VAT.
  fee                       numeric not null default 0,
  -- Covered visits per contract year. Null = unlimited.
  included_visits           integer,
  includes_remote_support   boolean not null default true,
  -- Hourly rate (ex VAT) for work the plan doesn't cover, and the yardstick
  -- for what covered work would otherwise have cost the client.
  callout_rate              numeric,
  covered_job_types         text[] not null default array['maintenance', 'callout', 'repair'],
  response_time             text,
  start_date                date not null,
  -- End of the current contract year.
  renewal_date              date not null,
  auto_renew                boolean not null default true,
  -- Next invoice the cron will raise. Null while paused or ended.
  next_invoice_date         date,
  status                    text not null default 'active',
  sage_customer_id          text,
  sage_customer_name        text,
  notes                     text,
  -- The renewal_date the 30-day reminder was last sent for, so it goes once.
  renewal_reminder_sent_for date,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

do $$ begin
  alter table elec_service_contracts add constraint elec_service_contracts_period_check
    check (billing_period in ('monthly', 'annual'));
  alter table elec_service_contracts add constraint elec_service_contracts_status_check
    check (status in ('active', 'paused', 'ended'));
exception when duplicate_object then null; end $$;

create index if not exists elec_service_contracts_account_idx on elec_service_contracts (portal_account_id);
create index if not exists elec_service_contracts_client_idx  on elec_service_contracts (client_id);
create index if not exists elec_service_contracts_due_idx     on elec_service_contracts (next_invoice_date) where status = 'active';

-- One invoice per contract per billing period.
create table if not exists elec_contract_invoices (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null references elec_service_contracts(id) on delete cascade,
  portal_account_id   uuid not null references supplier_portal_accounts(id) on delete cascade,
  invoice_number      text not null,
  invoice_date        date not null,
  due_date            date,
  period_start        date not null,
  period_end          date not null,
  -- Ex VAT.
  amount              numeric not null,
  vat_rate            numeric not null default 15,
  status              text not null default 'draft',
  sent_at             timestamptz,
  paid_at             timestamptz,
  sage_invoice_id     text,
  sage_invoice_status text,
  sage_pushed_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (contract_id, period_start)
);

do $$ begin
  alter table elec_contract_invoices add constraint elec_contract_invoices_status_check
    check (status in ('draft', 'sent', 'paid', 'void'));
exception when duplicate_object then null; end $$;

create index if not exists elec_contract_invoices_account_idx on elec_contract_invoices (portal_account_id);

alter table elec_service_contracts enable row level security;
alter table elec_contract_invoices enable row level security;

-- Which plan a job card falls under, and whether this visit is on the plan
-- or charged. Set when the card is created; the office can override.
alter table elec_job_cards
  add column if not exists service_contract_id uuid references elec_service_contracts(id) on delete set null,
  add column if not exists contract_coverage   text;

do $$ begin
  alter table elec_job_cards add constraint elec_job_cards_contract_coverage_check
    check (contract_coverage is null or contract_coverage in ('covered', 'billable'));
exception when duplicate_object then null; end $$;

-- Support invoice numbering and whether the cron emails them itself.
alter table elec_settings
  add column if not exists contract_invoice_prefix text not null default 'SUP',
  add column if not exists contract_invoices_auto_send boolean not null default false;
