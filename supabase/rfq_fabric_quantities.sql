-- Fabric & leather quantities on a supplier's RFQ answer.
--
-- A designer specifies which cloth goes on a piece; only the maker knows how
-- many metres it takes, and normally the designer leaves the yardage blank
-- altogether. So the supplier is asked for it on their pricing form — one box
-- per cloth — and the number they give flows onto that cloth's own child line
-- item when the designer applies the quote.
--
-- Run by hand in the Supabase SQL editor (same as every other migration here).

-- What the supplier answered, as [{ key, label, quantity, designerQuantity }].
-- `key` ties one cloth to its own line: see materialQuantityKey in
-- src/lib/studio/types.ts, which is also what stamps line_items below.
alter table spec_quotes
  add column if not exists material_quantities jsonb not null default '[]'::jsonb;

-- The same key, stamped on the child line item at board → quote conversion.
-- Without it a returned quantity has no line to land on: children all share
-- their parent's studio_object_id, so the fabric and the leather under one
-- chair are indistinguishable from each other.
alter table line_items
  add column if not exists studio_material_key text;

create index if not exists line_items_studio_material_key_idx
  on line_items (studio_material_key)
  where studio_material_key is not null;
