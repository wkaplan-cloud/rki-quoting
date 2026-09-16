-- Supplier price revisions: know when a quoted price changed, and whether the
-- one that changed had already been used on a quote.
-- Run manually in the Supabase SQL editor.
--
-- Applying a supplier's price used to write cost_price onto a line item and
-- leave no trace, so a supplier revising their price after you had quoted the
-- client was undetectable in principle. These three columns are that trace:
-- applied_price is the amount as applied, so it going out of step with price
-- is exactly the definition of a stale quote.

alter table spec_quotes add column if not exists applied_to_line_item_id uuid
  references line_items(id) on delete set null;
alter table spec_quotes add column if not exists applied_at timestamptz;
alter table spec_quotes add column if not exists applied_price numeric;

create index if not exists spec_quotes_applied_idx
  on spec_quotes (applied_to_line_item_id)
  where applied_to_line_item_id is not null;

-- Why the supplier came back, asked for on the form when they unlock a
-- submitted sheet. Carried into the revision email.
alter table rfq_submission_log add column if not exists revision_reason text;
