-- Manufacturing: manual (typed) pricing on quote line items
--
-- Until now every line item price was derived from the cost builder:
--   unit_price = (components + labour) × (1 + markup)
-- Manufacturers who quote from experience ("this costs me R120k, I sell it at
-- R180k") had to reverse-engineer a markup percentage to land on the price they
-- already knew. `pricing_mode = 'manual'` lets them type cost and selling price
-- directly; 'built' keeps the existing cost-builder behaviour.
--
-- cost_per_unit becomes nullable so "no cost captured" is distinguishable from
-- "costs R0". A NULL cost is skipped by sum() in recalculate_mfg_quote_totals,
-- so those lines are excluded from total_cost rather than counted as pure
-- profit.

alter table mfg_quote_line_items
  add column if not exists pricing_mode text not null default 'built';

alter table mfg_quote_line_items
  drop constraint if exists mfg_quote_line_items_pricing_mode_check;

alter table mfg_quote_line_items
  add constraint mfg_quote_line_items_pricing_mode_check
  check (pricing_mode in ('built', 'manual'));

alter table mfg_quote_line_items
  alter column cost_per_unit drop not null;
