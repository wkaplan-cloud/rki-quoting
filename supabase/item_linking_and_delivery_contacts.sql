-- ─── Item 1: parent-child linking ─────────────────────────────────────────────
alter table line_items add column if not exists parent_item_id uuid references line_items(id) on delete set null;

-- ─── Item 2: delivery contact fields on supplier ───────────────────────────────
alter table suppliers add column if not exists delivery_contact_name text;
alter table suppliers add column if not exists delivery_contact_number text;

-- ─── Item 8: fabric width on line item ────────────────────────────────────────
alter table line_items add column if not exists fabric_width_cm numeric;
