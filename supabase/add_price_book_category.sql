-- Add category grouping to elec_item_library so it doubles as a price book.
-- Run once in Supabase SQL editor.

alter table elec_item_library
  add column if not exists category text;
