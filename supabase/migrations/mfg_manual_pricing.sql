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

-- Quote totals: exclude uncosted lines from BOTH sides of the profit sum.
--
-- The previous version did total_profit = subtotal - total_cost. On a quote
-- mixing costed and uncosted lines that overstates profit, because the
-- uncosted lines contribute their full selling price to the subtotal while
-- contributing nothing to the cost. Profit is now measured only across the
-- lines whose cost is actually known; subtotal stays the full client-facing
-- figure.
create or replace function recalculate_mfg_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_subtotal       numeric;
  v_total_cost     numeric;
  v_costed_revenue numeric;
  v_vat_rate       numeric;
  v_apply_vat      boolean;
  v_vat_amount     numeric;
begin
  select
    coalesce(sum(line_total), 0),
    coalesce(sum(cost_per_unit * quantity) filter (where cost_per_unit is not null), 0),
    coalesce(sum(line_total)               filter (where cost_per_unit is not null), 0)
  into v_subtotal, v_total_cost, v_costed_revenue
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
         total_profit = v_costed_revenue - v_total_cost,
         updated_at   = now()
   where id = p_quote_id;
end;
$$;
