-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Align RLS with org-based tenant model
-- File: supabase/migrate_org_rls.sql
--
-- Prerequisites:
--   - organizations, org_members tables must exist (created in Supabase dashboard)
--   - get_current_org_id() function must exist and be working (used by price_lists)
--
-- Tables NOT changed (already correct):
--   price_lists, price_list_items         — already use get_current_org_id() ✓
--   supplier_portal_accounts              — supplier-individual, correct ✓
--   supplier_price_list_items             — chains through portal account, correct ✓
--   twinbru_sync_log                      — no RLS, service role only ✓
--
-- Safe to run on a live database:
--   - All ADD COLUMN use IF NOT EXISTS
--   - Backfill only touches rows where org_id IS NULL
--   - Old policies are dropped before new ones are created
--   - Solo/orphaned rows (org_id NULL after backfill) retain access via user_id fallback
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── PART 1: Add org_id columns ───────────────────────────────────────────────
-- IF NOT EXISTS means this is safe even if columns already exist in production.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE sourcing_requests
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- line_items, project_stages, sourcing_request_images, sourcing_request_recipients,
-- sourcing_request_responses, sourcing_messages: no direct org_id needed —
-- their new policies chain through the org-aware parent table.


-- ─── PART 2: Backfill org_id from org_members ─────────────────────────────────
-- For each user_id look up their active org membership and stamp org_id.
-- Only rows where org_id IS NULL are touched — idempotent on re-run.
-- Users with no active org_members row are left with org_id = NULL;
-- the new policies fall back to user_id = auth.uid() for those rows.

DO $$
BEGIN
  UPDATE clients c
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = c.user_id
    AND om.status  = 'active'
    AND c.org_id   IS NULL;

  UPDATE suppliers s
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = s.user_id
    AND om.status  = 'active'
    AND s.org_id   IS NULL;

  UPDATE items i
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = i.user_id
    AND om.status  = 'active'
    AND i.org_id   IS NULL;

  UPDATE projects p
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = p.user_id
    AND om.status  = 'active'
    AND p.org_id   IS NULL;

  UPDATE settings s
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = s.user_id
    AND om.status  = 'active'
    AND s.org_id   IS NULL;

  UPDATE sourcing_requests sr
  SET org_id = om.org_id
  FROM org_members om
  WHERE om.user_id = sr.user_id
    AND om.status  = 'active'
    AND sr.org_id  IS NULL;

  RAISE NOTICE 'org_id backfill complete.';
END $$;

-- ─── VERIFY BACKFILL (run manually before continuing) ─────────────────────────
-- Any non-zero count means rows owned by users with no org membership.
-- Those rows will fall back to user_id access — that is intentional.
-- Zero count on all tables means a clean org-only deployment.
--
--   SELECT 'clients',          COUNT(*) FROM clients          WHERE org_id IS NULL
--   UNION ALL
--   SELECT 'suppliers',        COUNT(*) FROM suppliers        WHERE org_id IS NULL
--   UNION ALL
--   SELECT 'items',            COUNT(*) FROM items            WHERE org_id IS NULL
--   UNION ALL
--   SELECT 'projects',         COUNT(*) FROM projects         WHERE org_id IS NULL
--   UNION ALL
--   SELECT 'settings',         COUNT(*) FROM settings         WHERE org_id IS NULL
--   UNION ALL
--   SELECT 'sourcing_requests', COUNT(*) FROM sourcing_requests WHERE org_id IS NULL;


-- ─── PART 3: Drop old user_id RLS policies ────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own clients"                    ON clients;
DROP POLICY IF EXISTS "Users manage own suppliers"                  ON suppliers;
DROP POLICY IF EXISTS "Users manage own items"                      ON items;
DROP POLICY IF EXISTS "Users manage own projects"                   ON projects;
DROP POLICY IF EXISTS "Users manage own settings"                   ON settings;
DROP POLICY IF EXISTS "Users manage line items via project"         ON line_items;
DROP POLICY IF EXISTS "Users manage stages via project"             ON project_stages;
DROP POLICY IF EXISTS "Users manage own sourcing requests"          ON sourcing_requests;
DROP POLICY IF EXISTS "Users manage images via sourcing request"    ON sourcing_request_images;
DROP POLICY IF EXISTS "Users manage recipients via sourcing request" ON sourcing_request_recipients;
DROP POLICY IF EXISTS "Users read responses via sourcing request"   ON sourcing_request_responses;
DROP POLICY IF EXISTS "Designer manages messages"                   ON sourcing_messages;


-- ─── PART 4: New org-based policies ───────────────────────────────────────────
-- All policies use the pattern:
--   PRIMARY:  org_id = get_current_org_id()          — org members see shared data
--   FALLBACK: org_id IS NULL AND user_id = auth.uid() — solo/orphaned rows still accessible
--
-- Service role bypasses RLS entirely — no special handling needed.

-- ── clients ───────────────────────────────────────────────────────────────────
CREATE POLICY "Org members manage clients" ON clients
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

-- ── suppliers ─────────────────────────────────────────────────────────────────
CREATE POLICY "Org members manage suppliers" ON suppliers
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

-- ── items ─────────────────────────────────────────────────────────────────────
CREATE POLICY "Org members manage items" ON items
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

-- ── projects ──────────────────────────────────────────────────────────────────
CREATE POLICY "Org members manage projects" ON projects
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

-- ── settings ──────────────────────────────────────────────────────────────────
-- SELECT: all org members can read — business_name is shared config read by email routes.
-- INSERT/UPDATE/DELETE: only the record owner (each user manages their own row).
CREATE POLICY "Org members read settings" ON settings
  FOR SELECT
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "User inserts own settings" ON settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own settings" ON settings
  FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User deletes own settings" ON settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ── line_items ────────────────────────────────────────────────────────────────
-- Chains through projects — no org_id column on line_items itself.
CREATE POLICY "Org members manage line items" ON line_items
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = line_items.project_id
        AND (
          p.org_id = get_current_org_id()
          OR (p.org_id IS NULL AND p.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = line_items.project_id
        AND (
          p.org_id = get_current_org_id()
          OR (p.org_id IS NULL AND p.user_id = auth.uid())
        )
    )
  );

-- ── project_stages ────────────────────────────────────────────────────────────
CREATE POLICY "Org members manage stages" ON project_stages
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_stages.project_id
        AND (
          p.org_id = get_current_org_id()
          OR (p.org_id IS NULL AND p.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_stages.project_id
        AND (
          p.org_id = get_current_org_id()
          OR (p.org_id IS NULL AND p.user_id = auth.uid())
        )
    )
  );

-- ── sourcing_requests ─────────────────────────────────────────────────────────
CREATE POLICY "Org members manage sourcing requests" ON sourcing_requests
  USING (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    org_id = get_current_org_id()
    OR (org_id IS NULL AND user_id = auth.uid())
  );

-- ── sourcing_request_images ───────────────────────────────────────────────────
CREATE POLICY "Org members manage sourcing images" ON sourcing_request_images
  USING (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_images.sourcing_request_id
        AND (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_images.sourcing_request_id
        AND (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  );

-- ── sourcing_request_recipients ───────────────────────────────────────────────
CREATE POLICY "Org members manage sourcing recipients" ON sourcing_request_recipients
  USING (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_recipients.sourcing_request_id
        AND (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_recipients.sourcing_request_id
        AND (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  );

-- ── sourcing_request_responses ────────────────────────────────────────────────
-- Two-hop chain: responses → recipients → sourcing_requests.org_id
CREATE POLICY "Org members manage sourcing responses" ON sourcing_request_responses
  USING (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_request_responses.recipient_id
         AND (
           sr.org_id = get_current_org_id()
           OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_request_responses.recipient_id
         AND (
           sr.org_id = get_current_org_id()
           OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
         )
    )
  );

-- ── sourcing_messages ─────────────────────────────────────────────────────────
-- Two-hop chain: messages → recipients → sourcing_requests.org_id
CREATE POLICY "Org members manage sourcing messages" ON sourcing_messages
  USING (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_messages.recipient_id
         AND (
           sr.org_id = get_current_org_id()
           OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_messages.recipient_id
         AND (
           sr.org_id = get_current_org_id()
           OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
         )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST QUERIES
-- Run in Supabase SQL Editor using JWT impersonation (Auth → Users → "..." menu).
-- Replace placeholder UUIDs with real values from your database.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 0: Gather test values
--   SELECT id AS org_id FROM organizations LIMIT 3;
--   SELECT user_id, org_id, role FROM org_members WHERE status = 'active' LIMIT 10;

-- Test 1: User A can see their own clients
--   (Impersonate User A) → SELECT id, client_name, org_id FROM clients LIMIT 5;
--   Expected: rows where org_id = org_A

-- Test 2: User B (same org as A) can see User A's clients
--   (Impersonate User B) → SELECT id, client_name, org_id FROM clients LIMIT 5;
--   Expected: same rows as Test 1 — shared org data visible

-- Test 3: User C (different org) cannot see org A data
--   (Impersonate User C) → SELECT COUNT(*) FROM clients WHERE org_id = '<org_A_id>';
--   Expected: 0

-- Test 4: Cross-org leak check on projects
--   (Impersonate User C) → SELECT COUNT(*) FROM projects WHERE org_id = '<org_A_id>';
--   Expected: 0

-- Test 5: Org members can read settings (for business_name)
--   (Impersonate User B who did NOT create the settings row)
--   → SELECT business_name FROM settings WHERE org_id = '<org_id>';
--   Expected: 1 row returned

-- Test 6: User B cannot modify User A's settings
--   (Impersonate User B) → UPDATE settings SET business_name = 'test' WHERE user_id = '<user_A_id>';
--   Expected: 0 rows updated (RLS blocks it silently) or error

-- Test 7: Sourcing requests visible across same org
--   (Impersonate User B) → SELECT id, title FROM sourcing_requests LIMIT 5;
--   Expected: includes requests created by User A

-- Test 8: price_lists still work (unchanged)
--   (Impersonate User A) → SELECT id, name FROM price_lists LIMIT 5;
--   Expected: org's price lists returned as before

-- Test 9: Supplier portal still isolated (unchanged)
--   (Impersonate a supplier user) → SELECT id FROM supplier_portal_accounts;
--   Expected: exactly 1 row — their own account only

-- Test 10: Solo user with no org membership can still access their own data
--   (Impersonate a user with no org_members row)
--   → SELECT COUNT(*) FROM projects;
--   Expected: their own projects (org_id IS NULL fallback applies)


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK SQL
-- Run this entire block to revert to the original user_id-based policies.
-- The org_id columns are left in place — dropping them risks data loss.
-- ═══════════════════════════════════════════════════════════════════════════════

/*
DROP POLICY IF EXISTS "Org members manage clients"              ON clients;
DROP POLICY IF EXISTS "Org members manage suppliers"            ON suppliers;
DROP POLICY IF EXISTS "Org members manage items"                ON items;
DROP POLICY IF EXISTS "Org members manage projects"             ON projects;
DROP POLICY IF EXISTS "Org members read settings"               ON settings;
DROP POLICY IF EXISTS "User inserts own settings"               ON settings;
DROP POLICY IF EXISTS "User updates own settings"               ON settings;
DROP POLICY IF EXISTS "User deletes own settings"               ON settings;
DROP POLICY IF EXISTS "Org members manage line items"           ON line_items;
DROP POLICY IF EXISTS "Org members manage stages"               ON project_stages;
DROP POLICY IF EXISTS "Org members manage sourcing requests"    ON sourcing_requests;
DROP POLICY IF EXISTS "Org members manage sourcing images"      ON sourcing_request_images;
DROP POLICY IF EXISTS "Org members manage sourcing recipients"  ON sourcing_request_recipients;
DROP POLICY IF EXISTS "Org members manage sourcing responses"   ON sourcing_request_responses;
DROP POLICY IF EXISTS "Org members manage sourcing messages"    ON sourcing_messages;

CREATE POLICY "Users manage own clients"   ON clients   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own suppliers" ON suppliers USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own items"     ON items     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own projects"  ON projects  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own settings"  ON settings  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage line items via project" ON line_items
  USING  (EXISTS (SELECT 1 FROM projects p WHERE p.id = line_items.project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = line_items.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Users manage stages via project" ON project_stages
  USING  (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_stages.project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = project_stages.project_id AND p.user_id = auth.uid()));

CREATE POLICY "Users manage own sourcing requests" ON sourcing_requests
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage images via sourcing request" ON sourcing_request_images
  USING (EXISTS (
    SELECT 1 FROM sourcing_requests sr
    WHERE sr.id = sourcing_request_images.sourcing_request_id AND sr.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sourcing_requests sr
    WHERE sr.id = sourcing_request_images.sourcing_request_id AND sr.user_id = auth.uid()
  ));

CREATE POLICY "Users manage recipients via sourcing request" ON sourcing_request_recipients
  USING (EXISTS (
    SELECT 1 FROM sourcing_requests sr
    WHERE sr.id = sourcing_request_recipients.sourcing_request_id AND sr.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sourcing_requests sr
    WHERE sr.id = sourcing_request_recipients.sourcing_request_id AND sr.user_id = auth.uid()
  ));

CREATE POLICY "Users read responses via sourcing request" ON sourcing_request_responses
  USING (EXISTS (
    SELECT 1 FROM sourcing_request_recipients srr
    JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
    WHERE srr.id = sourcing_request_responses.recipient_id AND sr.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sourcing_request_recipients srr
    JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
    WHERE srr.id = sourcing_request_responses.recipient_id AND sr.user_id = auth.uid()
  ));

CREATE POLICY "Designer manages messages" ON sourcing_messages
  USING (EXISTS (
    SELECT 1 FROM sourcing_request_recipients srr
    JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
    WHERE srr.id = sourcing_messages.recipient_id AND sr.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sourcing_request_recipients srr
    JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
    WHERE srr.id = sourcing_messages.recipient_id AND sr.user_id = auth.uid()
  ));
*/
