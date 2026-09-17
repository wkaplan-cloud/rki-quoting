-- Per-component record of a price having been used on a quote.
--
-- spec_quotes carries applied_at / applied_price for the ITEM's price, which
-- was enough while one supplier answer meant one figure. A cushion workroom
-- quoting two sizes of scatter gives two, landing on two different lines, and
-- a single column can only remember the last of them — so a price the studio
-- had already carried onto a client quote could move underneath them without
-- anything being able to say so.
--
-- Item prices keep using spec_quotes.applied_*; this is the components.
--
-- Run by hand in the Supabase SQL editor (same as every other migration here).

create table if not exists spec_quote_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  spec_quote_id uuid not null references spec_quotes(id) on delete cascade,
  -- Which part of the item — see materialQuantityKey in src/lib/studio/types.ts
  material_key text not null,
  line_item_id uuid not null references line_items(id) on delete cascade,
  -- The amount AS APPLIED. Going out of step with the supplier's current
  -- answer is exactly what makes a stale price detectable later.
  applied_price numeric not null,
  applied_quantity numeric,
  applied_at timestamptz not null default now(),
  -- One record per part per quote: re-applying updates it rather than
  -- stacking a second row that would make "what did we use?" ambiguous
  unique (spec_quote_id, material_key)
);

create index if not exists spec_quote_applications_quote_idx
  on spec_quote_applications (spec_quote_id);
create index if not exists spec_quote_applications_line_item_idx
  on spec_quote_applications (line_item_id);

alter table spec_quote_applications enable row level security;

drop policy if exists spec_quote_applications_org_rw on spec_quote_applications;
create policy spec_quote_applications_org_rw on spec_quote_applications
  for all
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id());
