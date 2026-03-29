-- ─── Twinbru live sync additions ─────────────────────────────────────────────
-- Run this migration in Supabase SQL Editor

-- 1. Track when a fabric's price last changed in price_list_items
alter table price_list_items
  add column if not exists price_updated_at timestamptz;

-- 2. Store the Twinbru product ID on line items (so we can detect stale prices)
alter table line_items
  add column if not exists twinbru_product_id integer;

-- 3. Store the Twinbru price at the time it was selected (to compare against later)
alter table line_items
  add column if not exists twinbru_cost_price numeric;

-- 4. Sync log — one row per sync run (both price syncs and catalogue syncs)
create table if not exists twinbru_sync_log (
  id uuid primary key default uuid_generate_v4(),
  sync_type text not null,          -- 'prices' | 'catalogue'
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',  -- 'running' | 'ok' | 'error'
  items_checked integer,
  items_changed integer,
  items_added integer,
  error_message text,
  triggered_by text default 'cron'  -- 'cron' | 'manual'
);

-- No RLS needed — only service role writes to this table
