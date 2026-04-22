-- ─── Supplier Portal migration ────────────────────────────────────────────────
-- Run in Supabase SQL editor.
-- Creates supplier portal accounts and price list tables.

-- 1. supplier_portal_accounts ─────────────────────────────────────────────────
-- Suppliers register their own auth accounts here, separate from designer-owned
-- supplier records. Linked to price requests by matching email at query time.

CREATE TABLE IF NOT EXISTS supplier_portal_accounts (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email           text        NOT NULL,
  company_name    text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE supplier_portal_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier owns portal account" ON supplier_portal_accounts
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- 2. supplier_price_list_items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_price_list_items (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_account_id uuid        REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE NOT NULL,
  item_name         text        NOT NULL,
  description       text,
  sku               text,
  unit              text,
  price             numeric,
  lead_time_weeks   integer,
  image_url         text,
  sort_order        integer     NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE supplier_price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier owns price list items" ON supplier_price_list_items
  USING (
    EXISTS (
      SELECT 1 FROM supplier_portal_accounts spa
       WHERE spa.id = supplier_price_list_items.portal_account_id
         AND spa.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supplier_portal_accounts spa
       WHERE spa.id = supplier_price_list_items.portal_account_id
         AND spa.auth_user_id = auth.uid()
    )
  );

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Create a PUBLIC bucket named "supplier-price-list-images" in Supabase dashboard.
-- Storage → New bucket → Name: supplier-price-list-images → Public: ON
-- Path pattern: {portal_account_id}/{timestamp}.{ext}
