-- Option lines (option_label set) sit outside a manufacturing quote's total
-- until the client picks one — the PDF already showed them that way, but the
-- stored subtotal counted every option, so the builder, the quotes list and
-- any invoice converted from the quote billed all of them. They are now left
-- out of the subtotal and the margin figures alike.
-- Delivery and installation are taxed and added to the total here too, the
-- same as the quote PATCH route does — without them, editing any line item
-- dropped both from the stored total.
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
  v_taxable        numeric;
begin
  select
    coalesce(sum(line_total), 0),
    coalesce(sum(cost_per_unit * quantity) filter (where cost_per_unit is not null), 0),
    coalesce(sum(line_total)               filter (where cost_per_unit is not null), 0)
  into v_subtotal, v_total_cost, v_costed_revenue
  from mfg_quote_line_items
  where quote_id = p_quote_id
    and option_label is null;

  select vat_rate, apply_vat,
         v_subtotal + coalesce(delivery_cost, 0) + coalesce(installation_cost, 0)
  into v_vat_rate, v_apply_vat, v_taxable
  from mfg_quotes
  where id = p_quote_id;

  v_vat_amount := case when v_apply_vat then round(v_taxable * v_vat_rate / 100, 2) else 0 end;

  update mfg_quotes
     set subtotal     = v_subtotal,
         vat_amount   = v_vat_amount,
         total        = v_taxable + v_vat_amount,
         total_cost   = v_total_cost,
         total_profit = v_costed_revenue - v_total_cost,
         updated_at   = now()
   where id = p_quote_id;
end;
$$;
