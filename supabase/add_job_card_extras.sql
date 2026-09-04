-- ─── Job Card Extra Work ──────────────────────────────────────────────────────
-- Extra work the client asks for while a job card is being worked on site.
--
-- Flow:
--   1. Staff logs extra-work items free-hand on the job card (no pricing).
--   2. Staff sends the batch to the office.
--   3. A separate DRAFT quote is created from those items, every rate at 0,
--      linked back to the job card via elec_quotes.source_job_card_id.
--   4. Office prices the quote in the normal quote editor and sends it to the
--      client for approval through the existing share-link flow.
--
-- Items are batched: an item with quote_id null has not been sent yet. Staff can
-- log a second batch later and send it as its own quote.
--
-- Run once in the Supabase SQL editor.

create table if not exists elec_job_card_extras (
  id                  uuid primary key default gen_random_uuid(),
  job_card_id         uuid not null references elec_job_cards(id) on delete cascade,
  portal_account_id   uuid not null references supplier_portal_accounts(id) on delete cascade,
  description         text not null,
  unit                text,
  qty                 numeric not null default 1,
  notes               text,
  created_by_staff_id uuid references elec_staff(id) on delete set null,
  created_by_name     text,
  -- Set when the batch is sent to the office and turned into a draft quote.
  quote_id            uuid references elec_quotes(id) on delete set null,
  submitted_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_job_card_extras_card    on elec_job_card_extras (job_card_id);
create index if not exists idx_job_card_extras_account on elec_job_card_extras (portal_account_id);
create index if not exists idx_job_card_extras_quote   on elec_job_card_extras (quote_id);

alter table elec_job_card_extras enable row level security;

create policy "Supplier owns elec_job_card_extras" on elec_job_card_extras
  using (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_job_card_extras.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from supplier_portal_accounts spa
       where spa.id = elec_job_card_extras.portal_account_id
         and spa.auth_user_id = auth.uid()
    )
  );

-- Reverse link: which job card this quote came out of.
alter table elec_quotes
  add column if not exists source_job_card_id uuid references elec_job_cards(id) on delete set null;

create index if not exists idx_elec_quotes_source_job_card on elec_quotes (source_job_card_id);

-- Kill switch. On for every electrician; set to false per account if one of them
-- does not want the extra-work step in front of their staff.
alter table elec_settings
  add column if not exists job_card_extras_enabled boolean not null default true;

comment on column elec_settings.job_card_extras_enabled is
  'Shows the Extra Work step on staff job cards and the Extra Work tab in the office job card.';
