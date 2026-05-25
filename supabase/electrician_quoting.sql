-- ─── Electrician Quoting Module ──────────────────────────────────────────────
-- Run in Supabase SQL editor.
-- Adds a full project/claims/COC management system for electrician suppliers.

-- ─── Helper: RLS policy for supplier-owned tables ────────────────────────────
-- All tables use the same pattern:
--   EXISTS (SELECT 1 FROM supplier_portal_accounts WHERE id = <fk> AND auth_user_id = auth.uid())


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. SUBSCRIPTION FIELDS on supplier_portal_accounts
-- ═══════════════════════════════════════════════════════════════════════════════

alter table supplier_portal_accounts
  add column if not exists plan                       text        default 'free',
  add column if not exists plan_category              text,
  add column if not exists subscription_status        text,
  add column if not exists paystack_reference         text,
  add column if not exists paystack_subscription_code text,
  add column if not exists paystack_customer_code     text;

-- plan: 'free' | 'quoting'
-- plan_category: 'electrician' | 'plumber' | 'manufacturer'
-- subscription_status: 'active' | 'cancelled' | 'past_due'


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ELECTRICIAN SETTINGS
-- Business defaults that pre-fill on every new quote and PDF.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_settings (
  id                                uuid        primary key default uuid_generate_v4(),
  portal_account_id                 uuid        references supplier_portal_accounts(id) on delete cascade not null unique,
  -- Business identity
  cidb_registration_number          text,
  company_registration_number       text,
  vat_registration_number           text,
  -- Banking (for PDF payment details)
  bank_name                         text,
  bank_account_number               text,
  bank_branch_code                  text,
  bank_account_type                 text,
  -- Quote defaults (pre-fill on new quotes)
  default_vat_rate                  numeric     default 15,
  default_retention_percentage      numeric     default 0,
  default_payment_terms_days        integer     default 30,
  default_defects_liability_days    integer     default 90,
  -- Document numbering prefixes
  quote_prefix                      text        default 'EQ',
  claim_prefix                      text        default 'CLM',
  vo_prefix                         text        default 'VO',
  coc_prefix                        text        default 'COC',
  -- PDF footer
  email_footer_text                 text,
  created_at                        timestamptz default now(),
  updated_at                        timestamptz default now()
);

alter table elec_settings enable row level security;

create policy "Supplier owns elec_settings" on elec_settings
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_settings.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_settings.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CLIENTS
-- The electrician's own client directory.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_clients (
  id                uuid        primary key default uuid_generate_v4(),
  portal_account_id uuid        references supplier_portal_accounts(id) on delete cascade not null,
  client_name       text        not null,
  company           text,
  email             text,
  contact_number    text,
  vat_number        text,
  address           text,
  -- Payment terms can differ per client
  payment_terms_days integer,
  notes             text,
  created_at        timestamptz default now()
);

alter table elec_clients enable row level security;

create policy "Supplier owns elec_clients" on elec_clients
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_clients.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_clients.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ITEM LIBRARY  ← smart autocomplete
-- Saved line item descriptions with default rates.
-- Populated automatically when quotes are saved; usage_count drives ranking.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_item_library (
  id                    uuid        primary key default uuid_generate_v4(),
  portal_account_id     uuid        references supplier_portal_accounts(id) on delete cascade not null,
  description           text        not null,
  unit                  text,
  item_type             text        default 'both',
  default_unit_rate     numeric,
  default_labour_rate   numeric,
  default_material_rate numeric,
  usage_count           integer     not null default 1,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (portal_account_id, description)
);

alter table elec_item_library enable row level security;

create policy "Supplier owns elec_item_library" on elec_item_library
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_item_library.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_item_library.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SECTION LIBRARY  ← smart autocomplete for section headings
-- e.g. "DB Board", "Lighting Circuit", "Power Outlets", "Earthing"
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_section_library (
  id                uuid        primary key default uuid_generate_v4(),
  portal_account_id uuid        references supplier_portal_accounts(id) on delete cascade not null,
  title             text        not null,
  usage_count       integer     not null default 1,
  created_at        timestamptz default now(),
  unique (portal_account_id, title)
);

alter table elec_section_library enable row level security;

create policy "Supplier owns elec_section_library" on elec_section_library
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_section_library.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_section_library.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. QUOTES  (master project record)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_quotes (
  id                              uuid        primary key default uuid_generate_v4(),
  portal_account_id               uuid        references supplier_portal_accounts(id) on delete cascade not null,
  client_id                       uuid        references elec_clients(id) on delete set null,
  quote_number                    text        not null,         -- e.g. EQ-2024-001
  project_name                    text        not null,
  project_address                 text,
  description                     text,
  project_type                    text,                         -- 'residential'|'commercial'|'industrial'|'retail'
  contract_type                   text        default 'lump_sum', -- 'lump_sum'|'re_measurement'|'cost_plus'
  status                          text        not null default 'draft',
  -- status: 'draft'|'quoted'|'approved'|'in_progress'|'completed'|'cancelled'
  vat_rate                        numeric     not null default 15,
  retention_percentage            numeric     not null default 0,
  payment_terms_days              integer     not null default 30,
  liquidated_damages_per_day      numeric,
  defects_liability_period_days   integer     not null default 90,
  notes                           text,
  -- Key dates
  quoted_date                     date,
  approved_date                   date,
  expected_completion_date        date,
  practical_completion_date       date,       -- actual; triggers retention release + defects clock
  -- Soft delete
  archived_at                     timestamptz,
  created_at                      timestamptz default now()
);

alter table elec_quotes enable row level security;

create policy "Supplier owns elec_quotes" on elec_quotes
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_quotes.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_quotes.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. PROJECT CONTACTS  (stakeholders beyond the client)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_project_contacts (
  id          uuid        primary key default uuid_generate_v4(),
  quote_id    uuid        references elec_quotes(id) on delete cascade not null,
  role        text        not null,  -- 'client'|'main_contractor'|'engineer'|'architect'|'site_agent'|'quantity_surveyor'
  name        text        not null,
  company     text,
  email       text,
  phone       text,
  -- Is this the contact claims/invoices get sent to?
  is_billing_contact boolean not null default false,
  created_at  timestamptz default now()
);

alter table elec_project_contacts enable row level security;

create policy "Supplier owns elec_project_contacts" on elec_project_contacts
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_project_contacts.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_project_contacts.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. QUOTE SECTIONS  (e.g. "DB Board", "Lighting Circuit")
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_quote_sections (
  id          uuid        primary key default uuid_generate_v4(),
  quote_id    uuid        references elec_quotes(id) on delete cascade not null,
  title       text        not null,
  sort_order  integer     not null default 0,
  created_at  timestamptz default now()
);

alter table elec_quote_sections enable row level security;

create policy "Supplier owns elec_quote_sections" on elec_quote_sections
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_quote_sections.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_quote_sections.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. QUOTE LINE ITEMS
-- Holds original quote values (locked on approval) and as-built actuals.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_quote_line_items (
  id                    uuid        primary key default uuid_generate_v4(),
  quote_id              uuid        references elec_quotes(id) on delete cascade not null,
  section_id            uuid        references elec_quote_sections(id) on delete set null,
  -- What it is
  description           text        not null default '',
  unit                  text,                           -- 'm'|'nr'|'lot'|'allow'|'m²'|'kg'
  item_type             text        not null default 'both', -- 'labour'|'material'|'both'|'preliminary'|'subcontract'
  drawing_reference     text,                           -- e.g. "E-03 Rev 2"
  subcontractor_name    text,                           -- populated when item_type = 'subcontract'
  -- Original quote (these lock when status moves to 'approved')
  quoted_quantity       numeric     not null default 0,
  quoted_unit_rate      numeric     not null default 0,
  labour_rate           numeric,                        -- split of quoted_unit_rate
  material_rate         numeric,                        -- split of quoted_unit_rate
  -- As-built (editable once status = 'in_progress'; falls back to quoted values if null)
  as_built_quantity     numeric,
  as_built_unit_rate    numeric,
  -- Variation order link (set when is_variation = true)
  variation_order_id    uuid,                           -- FK added after elec_variation_orders created
  is_variation          boolean     not null default false,
  sort_order            integer     not null default 0,
  created_at            timestamptz default now()
);

alter table elec_quote_line_items enable row level security;

create policy "Supplier owns elec_quote_line_items" on elec_quote_line_items
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_quote_line_items.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_quote_line_items.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. VARIATION ORDERS
-- Formal, numbered, client-approved scope changes post-approval.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_variation_orders (
  id              uuid        primary key default uuid_generate_v4(),
  quote_id        uuid        references elec_quotes(id) on delete cascade not null,
  vo_number       text        not null,    -- VO-001
  description     text        not null,
  status          text        not null default 'pending', -- 'pending'|'approved'|'rejected'
  value           numeric     not null default 0,  -- can be negative for omissions
  requested_by    text,
  approved_by     text,
  approved_date   date,
  notes           text,
  created_at      timestamptz default now()
);

alter table elec_variation_orders enable row level security;

create policy "Supplier owns elec_variation_orders" on elec_variation_orders
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_variation_orders.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_variation_orders.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );

-- Now that elec_variation_orders exists, add the FK from line items
alter table elec_quote_line_items
  add constraint fk_line_item_variation_order
  foreign key (variation_order_id)
  references elec_variation_orders(id)
  on delete set null;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. CLAIMS  (monthly progress claim)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_claims (
  id                  uuid        primary key default uuid_generate_v4(),
  quote_id            uuid        references elec_quotes(id) on delete cascade not null,
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  claim_number        text        not null,           -- CLM-001
  claim_date          date        not null default current_date,
  period_month        date        not null,           -- first day of billing month e.g. 2024-06-01
  claim_type          text        not null default 'invoice', -- 'invoice'|'proforma'
  status              text        not null default 'draft',
  -- status: 'draft'|'submitted'|'certified'|'invoiced'|'paid'
  -- Financial totals (computed from claim line items, stored for reporting)
  total_claimed       numeric     not null default 0,
  total_certified     numeric,
  total_invoiced      numeric,
  total_paid          numeric,
  -- Who it gets sent to
  sent_to_name        text,
  sent_to_email       text,
  sent_at             timestamptz,
  notes               text,
  created_at          timestamptz default now()
);

alter table elec_claims enable row level security;

create policy "Supplier owns elec_claims" on elec_claims
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_claims.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_claims.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. CLAIM LINE ITEMS  (per-line-item % breakdown of each claim)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_claim_line_items (
  id                      uuid        primary key default uuid_generate_v4(),
  claim_id                uuid        references elec_claims(id) on delete cascade not null,
  quote_line_item_id      uuid        references elec_quote_line_items(id) on delete cascade not null,
  -- What the electrician is claiming this period
  percentage_claimed      numeric     not null default 0,  -- 0–100, cumulative across all claims ≤ 100
  amount_claimed          numeric     not null default 0,
  -- What gets certified (filled by client/QS)
  percentage_certified    numeric,
  amount_certified        numeric,
  notes                   text,
  created_at              timestamptz default now()
);

alter table elec_claim_line_items enable row level security;

create policy "Supplier owns elec_claim_line_items" on elec_claim_line_items
  using (
    exists (
      select 1 from elec_claims ec
        join supplier_portal_accounts spa on spa.id = ec.portal_account_id
       where ec.id = elec_claim_line_items.claim_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_claims ec
        join supplier_portal_accounts spa on spa.id = ec.portal_account_id
       where ec.id = elec_claim_line_items.claim_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. CERTIFICATES  (proforma path: proforma → cert → invoice)
-- One cert per claim; only created when claim_type = 'proforma'
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_certificates (
  id                  uuid        primary key default uuid_generate_v4(),
  claim_id            uuid        references elec_claims(id) on delete cascade not null unique,
  quote_id            uuid        references elec_quotes(id) on delete cascade not null,
  certificate_number  text        not null,
  issue_date          date        not null default current_date,
  certified_amount    numeric     not null,
  issued_by           text,       -- certifying person / QS / engineer
  notes               text,
  created_at          timestamptz default now()
);

alter table elec_certificates enable row level security;

create policy "Supplier owns elec_certificates" on elec_certificates
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_certificates.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_certificates.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. CERTIFICATE OF COMPLIANCE (COC)
-- Legal requirement in SA under OHS Act. One or more per project.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_coc (
  id                          uuid        primary key default uuid_generate_v4(),
  quote_id                    uuid        references elec_quotes(id) on delete cascade not null,
  coc_number                  text        not null,
  installation_description    text        not null,
  issue_date                  date        not null,
  tester_name                 text        not null,
  tester_registration_number  text,       -- registered with Dept of Labour
  valid_until                 date,
  notes                       text,
  created_at                  timestamptz default now()
);

alter table elec_coc enable row level security;

create policy "Supplier owns elec_coc" on elec_coc
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_coc.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_coc.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. SNAG ITEMS  (defects list before practical completion sign-off)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists elec_snag_items (
  id              uuid        primary key default uuid_generate_v4(),
  quote_id        uuid        references elec_quotes(id) on delete cascade not null,
  description     text        not null,
  status          text        not null default 'open', -- 'open'|'in_progress'|'resolved'
  raised_date     date        not null default current_date,
  resolved_date   date,
  raised_by       text,
  notes           text,
  created_at      timestamptz default now()
);

alter table elec_snag_items enable row level security;

create policy "Supplier owns elec_snag_items" on elec_snag_items
  using (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_snag_items.quote_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from elec_quotes eq
        join supplier_portal_accounts spa on spa.id = eq.portal_account_id
       where eq.id = elec_snag_items.quote_id
         and spa.auth_user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES  (for dashboard queries and autocomplete lookups)
-- ═══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_elec_quotes_portal        on elec_quotes(portal_account_id);
create index if not exists idx_elec_quotes_status        on elec_quotes(status);
create index if not exists idx_elec_quotes_client        on elec_quotes(client_id);
create index if not exists idx_elec_line_items_quote     on elec_quote_line_items(quote_id);
create index if not exists idx_elec_line_items_section   on elec_quote_line_items(section_id);
create index if not exists idx_elec_claims_quote         on elec_claims(quote_id);
create index if not exists idx_elec_claims_period        on elec_claims(period_month);
create index if not exists idx_elec_claims_status        on elec_claims(status);
create index if not exists idx_elec_claim_items_claim    on elec_claim_line_items(claim_id);
create index if not exists idx_elec_item_library_search  on elec_item_library(portal_account_id, description text_pattern_ops);
create index if not exists idx_elec_section_library_search on elec_section_library(portal_account_id, title text_pattern_ops);


-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTOCOMPLETE HELPER FUNCTION
-- Called server-side when electrician types in a description field.
-- Returns top 10 matches ordered by usage (most used first).
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function search_elec_item_library(
  p_portal_account_id uuid,
  p_query             text
)
returns table (
  description           text,
  unit                  text,
  item_type             text,
  default_unit_rate     numeric,
  default_labour_rate   numeric,
  default_material_rate numeric,
  usage_count           integer
)
language sql
security definer
as $$
  select
    description,
    unit,
    item_type,
    default_unit_rate,
    default_labour_rate,
    default_material_rate,
    usage_count
  from elec_item_library
  where portal_account_id = p_portal_account_id
    and description ilike p_query || '%'
  order by usage_count desc, description
  limit 10;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- UPSERT HELPER FUNCTION
-- Called when a quote is saved — bumps usage_count or inserts new library entry.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function upsert_elec_item_library(
  p_portal_account_id     uuid,
  p_description           text,
  p_unit                  text,
  p_item_type             text,
  p_default_unit_rate     numeric,
  p_default_labour_rate   numeric,
  p_default_material_rate numeric
)
returns void
language sql
security definer
as $$
  insert into elec_item_library (
    portal_account_id, description, unit, item_type,
    default_unit_rate, default_labour_rate, default_material_rate,
    usage_count
  )
  values (
    p_portal_account_id, p_description, p_unit, p_item_type,
    p_default_unit_rate, p_default_labour_rate, p_default_material_rate,
    1
  )
  on conflict (portal_account_id, description)
  do update set
    usage_count           = elec_item_library.usage_count + 1,
    unit                  = coalesce(excluded.unit, elec_item_library.unit),
    default_unit_rate     = excluded.default_unit_rate,
    default_labour_rate   = excluded.default_labour_rate,
    default_material_rate = excluded.default_material_rate,
    updated_at            = now();
$$;
