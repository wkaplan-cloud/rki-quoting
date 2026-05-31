-- Add default cost rate to elec_item_library for margin tracking in quotes.
-- Run once in Supabase SQL editor.

alter table elec_item_library
  add column if not exists default_cost_rate numeric;
