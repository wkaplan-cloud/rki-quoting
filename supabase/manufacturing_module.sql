-- ─── Manufacturing Quoting Module ─────────────────────────────────────────────
-- Run in Supabase SQL editor.
-- Adds a full quoting/invoicing system for manufacturers (custom woodwork etc).
-- Follows the same patterns as electrician_quoting.sql

-- ─── RLS helper pattern (same as electrician module) ─────────────────────────
-- Owner access:
--   EXISTS (SELECT 1 FROM supplier_portal_accounts WHERE id = <fk> AND auth_user_id = auth.uid())
-- Owner OR team member access:
--   EXISTS (SELECT 1 FROM supplier_portal_accounts spa WHERE spa.id = <fk>
--     AND (spa.auth_user_id = auth.uid()
--       OR EXISTS (SELECT 1 FROM mfg_team_members m WHERE m.portal_account_id = spa.id
--                  AND m.auth_user_id = auth.uid() AND m.status = 'active')))


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. TEAM MEMBERS
-- Additional users (admins / team members) under one portal_account_id.
-- The portal_account_id owner is always the "Owner" role.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_team_members (
  id                  uuid        primary key default uuid_generate_v4(),
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  auth_user_id        uuid        references auth.users(id) on delete cascade,
  name                text        not null,
  email               text        not null,
  role                text        not null default 'team_member', -- 'admin' | 'team_member'
  status              text        not null default 'invited',     -- 'invited' | 'active' | 'inactive'
  invite_token        text,       -- used for email invite link
  invited_at          timestamptz default now(),
  accepted_at         timestamptz,
  created_at          timestamptz default now(),
  unique (portal_account_id, email)
);

alter table mfg_team_members enable row level security;

-- Owner manages team members
create policy "Owner manages mfg_team_members" on mfg_team_members
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_team_members.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_team_members.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );

-- Team members can read their own record
create policy "Team member reads own record" on mfg_team_members
  for select
  using (auth_user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. SETTINGS
-- One row per portal account. Business identity, PDF defaults, document numbering.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_settings (
  id                            uuid        primary key default uuid_generate_v4(),
  portal_account_id             uuid        references supplier_portal_accounts(id) on delete cascade not null unique,
  -- Business identity
  business_name                 text,
  logo_url                      text,
  address                       text,
  email                         text,
  phone                         text,
  company_registration_number   text,
  vat_registered                boolean     not null default false,
  vat_registration_number       text,
  -- Banking (printed on every quote and invoice PDF)
  bank_name                     text,
  bank_account_holder           text,
  bank_account_number           text,
  bank_branch_code              text,
  bank_account_type             text,       -- 'cheque' | 'savings' | 'current'
  -- Quote / invoice defaults
  default_vat_rate              numeric     not null default 15,
  default_markup_percentage     numeric     not null default 30,
  quote_validity_days           integer     not null default 30,
  default_deposit_percentage    numeric     not null default 50,
  default_payment_terms         text        default '50% deposit on acceptance, balance on completion.',
  terms_and_conditions          text,
  -- Document numbering
  quote_prefix                  text        not null default 'QUO',
  invoice_prefix                text        not null default 'INV',
  quote_number_seed             integer     not null default 1,   -- next number to use
  invoice_number_seed           integer     not null default 1,
  -- PDF appearance
  accent_color                  text        default '#1B4F8A',
  -- Email templates (variables: {client_name}, {job_name}, {doc_number}, {valid_until}, {due_date})
  email_template_quote          text,
  email_template_invoice        text,
  created_at                    timestamptz default now(),
  updated_at                    timestamptz default now()
);

alter table mfg_settings enable row level security;

create policy "Owner or admin manages mfg_settings" on mfg_settings
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_settings.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
                and m.role = 'admin'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_settings.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
                and m.role = 'admin'
           )
         )
    )
  );

-- Team members can read settings (needed for PDF generation, quote defaults)
create policy "Team member reads mfg_settings" on mfg_settings
  for select
  using (
    exists (
      select 1 from mfg_team_members m
       where m.portal_account_id = mfg_settings.portal_account_id
         and m.auth_user_id = auth.uid()
         and m.status = 'active'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CLIENTS
-- The manufacturer's own client directory.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_clients (
  id                  uuid        primary key default uuid_generate_v4(),
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  client_type         text        not null default 'individual',  -- 'individual' | 'company'
  client_name         text        not null,   -- company name or full name
  contact_person      text,                   -- primary contact if company
  email               text,
  phone               text,
  address             text,
  vat_number          text,                   -- printed on tax invoices if present
  notes               text,                   -- internal only, never on PDF
  referred_by         text,                   -- free text — client or source
  archived_at         timestamptz,
  created_at          timestamptz default now()
);

alter table mfg_clients enable row level security;

create policy "Owner or member manages mfg_clients" on mfg_clients
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_clients.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_clients.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PRICE BOOK ITEMS
-- Materials and hardware catalogue. item_type drives cost builder behaviour.
-- Materials always get markup. Hardware has a per-item markup default toggle.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_price_book_items (
  id                    uuid        primary key default uuid_generate_v4(),
  portal_account_id     uuid        references supplier_portal_accounts(id) on delete cascade not null,
  item_type             text        not null,   -- 'material' | 'hardware'
  category              text        not null,
  -- material categories: 'boards' | 'solid_timber' | 'acrylic_specialty'
  -- hardware categories: 'glass_mirrors' | 'hinges_rails' | 'handles_fittings' |
  --                      'stone_steel' | 'finishes_oils' | 'lighting'
  name                  text        not null,
  unit                  text        not null,   -- 'sheet'|'plank'|'meter'|'piece'|'litre'|'kg'|'custom'
  unit_custom           text,                   -- populated when unit = 'custom'
  cost_price            numeric,                -- null when supplier_quoted = true
  supplier_quoted       boolean     not null default false,  -- price varies, enter per job
  apply_markup_default  boolean     not null default true,   -- hardware items default to false typically
  supplier_name         text,
  supplier_contact      text,
  notes                 text,
  archived_at           timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table mfg_price_book_items enable row level security;

create policy "Owner or admin manages mfg_price_book_items" on mfg_price_book_items
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_price_book_items.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
                and m.role = 'admin'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_price_book_items.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
                and m.role = 'admin'
           )
         )
    )
  );

-- Team members can select from the price book (but never see cost_price in the UI)
create policy "Team member reads mfg_price_book_items" on mfg_price_book_items
  for select
  using (
    exists (
      select 1 from mfg_team_members m
       where m.portal_account_id = mfg_price_book_items.portal_account_id
         and m.auth_user_id = auth.uid()
         and m.status = 'active'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. JOBS
-- A job is a named project under a client. Quotes and invoices belong to jobs.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_jobs (
  id                  uuid        primary key default uuid_generate_v4(),
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  client_id           uuid        references mfg_clients(id) on delete set null,
  job_name            text        not null,   -- e.g. "Master Bedroom Built-ins"
  description         text,
  archived_at         timestamptz,
  created_at          timestamptz default now()
);

alter table mfg_jobs enable row level security;

create policy "Owner or member manages mfg_jobs" on mfg_jobs
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_jobs.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_jobs.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. QUOTES
-- Each revision is a new row. Same quote_number, incrementing revision_number.
-- e.g. QUO-001 rev 1, QUO-001 rev 2 — both rows, same quote_number.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_quotes (
  id                  uuid        primary key default uuid_generate_v4(),
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  job_id              uuid        references mfg_jobs(id) on delete cascade not null,
  quote_number        text        not null,   -- e.g. 'QUO-001' (same across all revisions)
  revision_number     integer     not null default 1,
  status              text        not null default 'draft',
  -- status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'invoiced'
  apply_vat           boolean     not null default true,
  vat_rate            numeric     not null default 15,
  valid_until         date,
  notes               text,                   -- internal only
  -- Sending
  sent_to_email       text,
  sent_at             timestamptz,
  sent_by_name        text,                   -- "Prepared by" on PDF
  sent_by_email       text,
  sent_by_phone       text,
  -- Acceptance
  acceptance_date     date,
  -- Stored totals (computed from line items, cached for reporting)
  subtotal            numeric     not null default 0,
  vat_amount          numeric     not null default 0,
  total               numeric     not null default 0,
  -- Internal totals (never on PDF)
  total_cost          numeric     not null default 0,
  total_profit        numeric     not null default 0,
  archived_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (portal_account_id, quote_number, revision_number)
);

alter table mfg_quotes enable row level security;

create policy "Owner or member manages mfg_quotes" on mfg_quotes
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_quotes.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_quotes.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. QUOTE LINE ITEMS
-- What the client sees on the PDF. Cost builder is in tables 8 & 9.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_quote_line_items (
  id                  uuid        primary key default uuid_generate_v4(),
  quote_id            uuid        references mfg_quotes(id) on delete cascade not null,
  sort_order          integer     not null default 0,
  -- Client-facing fields (on PDF)
  description         text        not null default '',
  callout_note        text,                   -- prints in muted red on PDF
  quantity            numeric     not null default 1,
  unit_price          numeric     not null default 0,   -- selling price per unit
  line_total          numeric     not null default 0,   -- quantity × unit_price
  -- Internal fields (never on PDF)
  markup_percentage   numeric     not null default 30,  -- can differ from default
  cost_per_unit       numeric     not null default 0,   -- from cost builder
  profit_per_unit     numeric     not null default 0,
  margin_percentage   numeric     not null default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table mfg_quote_line_items enable row level security;

create policy "Owner or member manages mfg_quote_line_items" on mfg_quote_line_items
  using (
    exists (
      select 1 from mfg_quotes q
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where q.id = mfg_quote_line_items.quote_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_quotes q
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where q.id = mfg_quote_line_items.quote_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. COST BUILD — MATERIALS  (cut list per line item)
-- Prices are snapshotted at time of adding — price book changes don't affect
-- existing quotes.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_cost_materials (
  id                    uuid        primary key default uuid_generate_v4(),
  line_item_id          uuid        references mfg_quote_line_items(id) on delete cascade not null,
  price_book_item_id    uuid        references mfg_price_book_items(id) on delete set null,
  -- Snapshot at time of adding (frozen — price book updates don't change existing quotes)
  item_name             text        not null,
  unit                  text        not null,
  quantity              numeric     not null default 1,
  unit_cost             numeric,                -- null when supplier_quoted = true
  supplier_quoted       boolean     not null default false,
  sort_order            integer     not null default 0,
  created_at            timestamptz default now()
);

alter table mfg_cost_materials enable row level security;

create policy "Owner or member manages mfg_cost_materials" on mfg_cost_materials
  using (
    exists (
      select 1 from mfg_quote_line_items li
        join mfg_quotes q on q.id = li.quote_id
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where li.id = mfg_cost_materials.line_item_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_quote_line_items li
        join mfg_quotes q on q.id = li.quote_id
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where li.id = mfg_cost_materials.line_item_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. COST BUILD — HARDWARE  (fittings, glass, lighting per line item)
-- apply_markup overrides the price book default for this specific line item.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_cost_hardware (
  id                    uuid        primary key default uuid_generate_v4(),
  line_item_id          uuid        references mfg_quote_line_items(id) on delete cascade not null,
  price_book_item_id    uuid        references mfg_price_book_items(id) on delete set null,
  -- Snapshot
  item_name             text        not null,
  unit                  text        not null,
  quantity              numeric     not null default 1,
  unit_cost             numeric,
  supplier_quoted       boolean     not null default false,
  apply_markup          boolean     not null default false,  -- overrides price book default
  sort_order            integer     not null default 0,
  created_at            timestamptz default now()
);

alter table mfg_cost_hardware enable row level security;

create policy "Owner or member manages mfg_cost_hardware" on mfg_cost_hardware
  using (
    exists (
      select 1 from mfg_quote_line_items li
        join mfg_quotes q on q.id = li.quote_id
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where li.id = mfg_cost_hardware.line_item_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_quote_line_items li
        join mfg_quotes q on q.id = li.quote_id
        join supplier_portal_accounts spa on spa.id = q.portal_account_id
       where li.id = mfg_cost_hardware.line_item_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. LINE ITEM TEMPLATES
-- Saved cost builds the manufacturer can reuse across quotes.
-- When loaded into a new quote, item names come from the template but prices
-- are pulled fresh from the price book at load time.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_line_item_templates (
  id                      uuid        primary key default uuid_generate_v4(),
  portal_account_id       uuid        references supplier_portal_accounts(id) on delete cascade not null,
  template_name           text        not null,
  description             text,
  callout_note            text,
  default_markup_percentage numeric    not null default 30,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table mfg_line_item_templates enable row level security;

create policy "Owner or member manages mfg_line_item_templates" on mfg_line_item_templates
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_line_item_templates.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_line_item_templates.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );

create table if not exists mfg_template_materials (
  id                    uuid        primary key default uuid_generate_v4(),
  template_id           uuid        references mfg_line_item_templates(id) on delete cascade not null,
  price_book_item_id    uuid        references mfg_price_book_items(id) on delete set null,
  item_name             text        not null,   -- snapshot of name at save time
  unit                  text        not null,
  quantity              numeric     not null default 1,
  sort_order            integer     not null default 0
);

alter table mfg_template_materials enable row level security;

create policy "Owner or member manages mfg_template_materials" on mfg_template_materials
  using (
    exists (
      select 1 from mfg_line_item_templates t
        join supplier_portal_accounts spa on spa.id = t.portal_account_id
       where t.id = mfg_template_materials.template_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_line_item_templates t
        join supplier_portal_accounts spa on spa.id = t.portal_account_id
       where t.id = mfg_template_materials.template_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );

create table if not exists mfg_template_hardware (
  id                    uuid        primary key default uuid_generate_v4(),
  template_id           uuid        references mfg_line_item_templates(id) on delete cascade not null,
  price_book_item_id    uuid        references mfg_price_book_items(id) on delete set null,
  item_name             text        not null,
  unit                  text        not null,
  quantity              numeric     not null default 1,
  apply_markup          boolean     not null default false,
  sort_order            integer     not null default 0
);

alter table mfg_template_hardware enable row level security;

create policy "Owner or member manages mfg_template_hardware" on mfg_template_hardware
  using (
    exists (
      select 1 from mfg_line_item_templates t
        join supplier_portal_accounts spa on spa.id = t.portal_account_id
       where t.id = mfg_template_hardware.template_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_line_item_templates t
        join supplier_portal_accounts spa on spa.id = t.portal_account_id
       where t.id = mfg_template_hardware.template_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. INVOICES
-- Converted from accepted quotes. invoice_type handles deposit/final split.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_invoices (
  id                  uuid        primary key default uuid_generate_v4(),
  portal_account_id   uuid        references supplier_portal_accounts(id) on delete cascade not null,
  quote_id            uuid        references mfg_quotes(id) on delete set null,
  job_id              uuid        references mfg_jobs(id) on delete cascade not null,
  invoice_number      text        not null,   -- e.g. 'INV-001', 'INV-001-D', 'INV-001-F'
  invoice_type        text        not null default 'full', -- 'full' | 'deposit' | 'final'
  status              text        not null default 'draft',
  -- status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue'
  apply_vat           boolean     not null default true,
  vat_rate            numeric     not null default 15,
  subtotal            numeric     not null default 0,
  vat_amount          numeric     not null default 0,
  total               numeric     not null default 0,
  amount_paid         numeric     not null default 0,
  due_date            date,
  -- Sending
  sent_to_email       text,
  sent_at             timestamptz,
  sent_by_name        text,
  sent_by_email       text,
  sent_by_phone       text,
  notes               text,
  archived_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table mfg_invoices enable row level security;

create policy "Owner or member manages mfg_invoices" on mfg_invoices
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_invoices.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_invoices.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. INVOICE PAYMENTS
-- Each payment recorded against an invoice. When sum = invoice.total → paid.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_invoice_payments (
  id                uuid        primary key default uuid_generate_v4(),
  invoice_id        uuid        references mfg_invoices(id) on delete cascade not null,
  amount            numeric     not null,
  payment_date      date        not null default current_date,
  payment_method    text        not null default 'eft', -- 'eft' | 'cash' | 'card' | 'other'
  reference         text,
  notes             text,
  created_at        timestamptz default now()
);

alter table mfg_invoice_payments enable row level security;

create policy "Owner or member manages mfg_invoice_payments" on mfg_invoice_payments
  using (
    exists (
      select 1 from mfg_invoices i
        join supplier_portal_accounts spa on spa.id = i.portal_account_id
       where i.id = mfg_invoice_payments.invoice_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  )
  with check (
    exists (
      select 1 from mfg_invoices i
        join supplier_portal_accounts spa on spa.id = i.portal_account_id
       where i.id = mfg_invoice_payments.invoice_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. ACTIVITY LOG
-- Immutable audit trail. One row per action on any quote or invoice.
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists mfg_activity_log (
  id                uuid        primary key default uuid_generate_v4(),
  portal_account_id uuid        references supplier_portal_accounts(id) on delete cascade not null,
  entity_type       text        not null,   -- 'quote' | 'invoice'
  entity_id         uuid        not null,
  action            text        not null,
  -- action examples: 'created' | 'sent' | 'revision_created' | 'status_changed' |
  --                  'converted_to_invoice' | 'payment_recorded' | 'marked_accepted' |
  --                  'marked_declined'
  actor_name        text,
  actor_email       text,
  metadata          jsonb,                  -- e.g. { "email": "...", "amount": 12500 }
  created_at        timestamptz default now()
);

alter table mfg_activity_log enable row level security;

create policy "Owner or member reads mfg_activity_log" on mfg_activity_log
  for select
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_activity_log.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );

create policy "Owner or member inserts mfg_activity_log" on mfg_activity_log
  for insert
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = mfg_activity_log.portal_account_id
         and (
           spa.auth_user_id = auth.uid()
           or exists (
             select 1 from mfg_team_members m
              where m.portal_account_id = spa.id
                and m.auth_user_id = auth.uid()
                and m.status = 'active'
           )
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_mfg_clients_portal          on mfg_clients(portal_account_id);
create index if not exists idx_mfg_clients_archived        on mfg_clients(portal_account_id) where archived_at is null;

create index if not exists idx_mfg_price_book_portal       on mfg_price_book_items(portal_account_id);
create index if not exists idx_mfg_price_book_type         on mfg_price_book_items(portal_account_id, item_type);
create index if not exists idx_mfg_price_book_active       on mfg_price_book_items(portal_account_id) where archived_at is null;

create index if not exists idx_mfg_jobs_portal             on mfg_jobs(portal_account_id);
create index if not exists idx_mfg_jobs_client             on mfg_jobs(client_id);

create index if not exists idx_mfg_quotes_portal           on mfg_quotes(portal_account_id);
create index if not exists idx_mfg_quotes_job              on mfg_quotes(job_id);
create index if not exists idx_mfg_quotes_status           on mfg_quotes(portal_account_id, status);
create index if not exists idx_mfg_quotes_number           on mfg_quotes(portal_account_id, quote_number);

create index if not exists idx_mfg_line_items_quote        on mfg_quote_line_items(quote_id);
create index if not exists idx_mfg_cost_materials_li       on mfg_cost_materials(line_item_id);
create index if not exists idx_mfg_cost_hardware_li        on mfg_cost_hardware(line_item_id);

create index if not exists idx_mfg_invoices_portal         on mfg_invoices(portal_account_id);
create index if not exists idx_mfg_invoices_job            on mfg_invoices(job_id);
create index if not exists idx_mfg_invoices_quote          on mfg_invoices(quote_id);
create index if not exists idx_mfg_invoices_status         on mfg_invoices(portal_account_id, status);

create index if not exists idx_mfg_payments_invoice        on mfg_invoice_payments(invoice_id);
create index if not exists idx_mfg_activity_entity         on mfg_activity_log(entity_type, entity_id);
create index if not exists idx_mfg_activity_portal         on mfg_activity_log(portal_account_id);

create index if not exists idx_mfg_templates_portal        on mfg_line_item_templates(portal_account_id);
create index if not exists idx_mfg_team_portal             on mfg_team_members(portal_account_id);
create index if not exists idx_mfg_team_auth               on mfg_team_members(auth_user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Get and atomically increment the next quote number for a portal account.
-- Returns the number to use (e.g. 1 → prefix becomes QUO-001).
create or replace function get_next_mfg_quote_number(p_portal_account_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_next integer;
begin
  update mfg_settings
     set quote_number_seed = quote_number_seed + 1,
         updated_at = now()
   where portal_account_id = p_portal_account_id
  returning quote_number_seed - 1 into v_next;
  return v_next;
end;
$$;

-- Get and atomically increment the next invoice number.
create or replace function get_next_mfg_invoice_number(p_portal_account_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_next integer;
begin
  update mfg_settings
     set invoice_number_seed = invoice_number_seed + 1,
         updated_at = now()
   where portal_account_id = p_portal_account_id
  returning invoice_number_seed - 1 into v_next;
  return v_next;
end;
$$;

-- Recalculate and update stored totals on a quote from its line items.
-- Call this after any line item or cost build change.
create or replace function recalculate_mfg_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_subtotal    numeric;
  v_total_cost  numeric;
  v_vat_rate    numeric;
  v_apply_vat   boolean;
  v_vat_amount  numeric;
begin
  select
    coalesce(sum(line_total), 0),
    coalesce(sum(cost_per_unit * quantity), 0)
  into v_subtotal, v_total_cost
  from mfg_quote_line_items
  where quote_id = p_quote_id;

  select vat_rate, apply_vat
  into v_vat_rate, v_apply_vat
  from mfg_quotes
  where id = p_quote_id;

  v_vat_amount := case when v_apply_vat then round(v_subtotal * v_vat_rate / 100, 2) else 0 end;

  update mfg_quotes
     set subtotal     = v_subtotal,
         vat_amount   = v_vat_amount,
         total        = v_subtotal + v_vat_amount,
         total_cost   = v_total_cost,
         total_profit = v_subtotal - v_total_cost,
         updated_at   = now()
   where id = p_quote_id;
end;
$$;

-- Update invoice payment status after a payment is recorded.
-- Sets status to 'paid', 'partially_paid', or keeps 'sent' based on balance.
create or replace function update_mfg_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total       numeric;
  v_paid        numeric;
  v_new_status  text;
begin
  select total into v_total from mfg_invoices where id = p_invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from mfg_invoice_payments
  where invoice_id = p_invoice_id;

  v_new_status := case
    when v_paid >= v_total then 'paid'
    when v_paid > 0        then 'partially_paid'
    else 'sent'
  end;

  update mfg_invoices
     set amount_paid = v_paid,
         status      = v_new_status,
         updated_at  = now()
   where id = p_invoice_id;
end;
$$;
