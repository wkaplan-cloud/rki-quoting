-- Allow individual markup percentage per hardware cost item.
-- null = use the line item's default markup_percentage.
alter table mfg_cost_hardware
  add column if not exists markup_percentage numeric;

alter table mfg_template_hardware
  add column if not exists markup_percentage numeric;
