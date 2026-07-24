-- Fixes: line items on a quote/invoice PDF occasionally rendering in the
-- wrong order (e.g. positions 10 and 11 swapped) because concurrent
-- per-row sort_order updates from drag-reorder could partially fail,
-- leaving two rows on the same project sharing a sort_order value —
-- Postgres does not guarantee ordering for ties.

-- 1. One-time repair: renumber every project's line items using their
--    existing sort_order (tie-broken by created_at, same rule the app's
--    reads now use) so any duplicates picked up along the way are resolved.
with ranked as (
  select id, row_number() over (
    partition by project_id
    order by sort_order, created_at
  ) - 1 as new_sort_order
  from line_items
)
update line_items li
set sort_order = ranked.new_sort_order
from ranked
where li.id = ranked.id
  and li.sort_order is distinct from ranked.new_sort_order;

-- 2. Prevent it from happening again: no two line items on the same
--    project may share a sort_order. Deferred so the app's single
--    multi-row upsert (which writes the whole new ordering at once)
--    can't trip over its own transient state.
alter table line_items
  add constraint line_items_project_sort_order_uidx
  unique (project_id, sort_order) deferrable initially deferred;
