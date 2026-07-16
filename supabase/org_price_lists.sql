-- ─── Org-owned price lists ────────────────────────────────────────────────────
-- Lets each org create and manage its own price lists alongside the
-- platform-managed ones (org_id IS NULL). Run in the Supabase SQL editor.
--
-- After this migration:
--   • org_id NULL  → platform list (managed via service role in /platform)
--   • org_id set   → owned by that org; org members manage it via RLS
--   • is_global    → platform list visible to every studio (access-gated in app)

alter table price_lists
  add column if not exists org_id uuid references organizations(id) on delete cascade;

alter table price_lists
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_price_lists_org_id on price_lists(org_id);

-- Replace every existing policy on both tables with the org-aware set
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('price_lists', 'price_list_items')
  loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;

-- price_lists ──────────────────────────────────────────────────────────────
-- Read: platform-global lists + your own org's lists
create policy "Read global and own org price lists" on price_lists
  for select to authenticated
  using (is_global = true or org_id = get_current_org_id());

-- Write: only your own org's non-global lists
create policy "Insert own org price lists" on price_lists
  for insert to authenticated
  with check (org_id = get_current_org_id() and is_global = false);

create policy "Update own org price lists" on price_lists
  for update to authenticated
  using (org_id = get_current_org_id())
  with check (org_id = get_current_org_id() and is_global = false);

create policy "Delete own org price lists" on price_lists
  for delete to authenticated
  using (org_id = get_current_org_id());

-- price_list_items ─────────────────────────────────────────────────────────
create policy "Read global and own org price list items" on price_list_items
  for select to authenticated
  using (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and (pl.is_global = true or pl.org_id = get_current_org_id())
    )
  );

create policy "Insert own org price list items" on price_list_items
  for insert to authenticated
  with check (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.org_id = get_current_org_id()
    )
  );

create policy "Update own org price list items" on price_list_items
  for update to authenticated
  using (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.org_id = get_current_org_id()
    )
  )
  with check (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.org_id = get_current_org_id()
    )
  );

create policy "Delete own org price list items" on price_list_items
  for delete to authenticated
  using (
    exists (
      select 1 from price_lists pl
      where pl.id = price_list_items.price_list_id
        and pl.org_id = get_current_org_id()
    )
  );
