-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Minimal org-RLS fix for sourcing_requests + suppliers null backfill
-- File: supabase/migrate_sourcing_org_rls.sql
--
-- Tables touched:
--   sourcing_requests              — ADD org_id column + backfill + RLS update
--   sourcing_request_images        — RLS update (chains through sourcing_requests)
--   sourcing_request_recipients    — RLS update (chains through sourcing_requests)
--   sourcing_request_responses     — RLS update (chains through recipients)
--   sourcing_messages              — RLS update (chains through recipients)
--   suppliers                      — backfill 1 null org_id row only, no policy change
--
-- Tables NOT touched:
--   clients, projects, items, settings, line_items, project_stages
--   price_lists, price_list_items, price_list_access
--   supplier_portal_accounts, supplier_price_list_items
--   organizations, org_members
--
-- Prerequisites:
--   - get_current_org_id() must exist (confirmed: callable via RPC)
--   - organizations and org_members tables must exist (confirmed)
--   - Run STEP 0 preflight checks FIRST and compare output before continuing
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── STEP 0: PREFLIGHT — run this block first, read the output ────────────────
-- Purpose: confirm the current live policy names for all 5 sourcing tables.
-- The DROP statements in Step 3 are written to match the names in sourcing_requests.sql
-- and sourcing_messages.sql. Verify the output matches before continuing.
--
-- Expected output (from SQL files):
--   sourcing_requests             → "Users manage own sourcing requests"
--   sourcing_request_images       → "Users manage images via sourcing request"
--   sourcing_request_recipients   → "Users manage recipients via sourcing request"
--   sourcing_request_responses    → "Users read responses via sourcing request"
--   sourcing_messages             → "Designer manages messages"
--
-- If any name differs, update the matching DROP POLICY line in Step 3 before running.

SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual, 120) AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'sourcing_requests',
    'sourcing_request_images',
    'sourcing_request_recipients',
    'sourcing_request_responses',
    'sourcing_messages'
  )
ORDER BY tablename, policyname;

-- Also confirm sourcing_requests does NOT yet have org_id:
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'sourcing_requests'
  AND column_name  = 'org_id';
-- Expected: 0 rows (column is missing). If 1 row returned, skip Step 1.

-- Confirm the 1 null supplier row still exists:
SELECT COUNT(*) AS null_supplier_org_ids
FROM suppliers
WHERE org_id IS NULL;
-- Expected: 1. If 0, skip the suppliers backfill in Step 2.


-- ─── STEP 1: Add org_id column to sourcing_requests ──────────────────────────
-- IF NOT EXISTS makes this safe to re-run.
-- No NOT NULL constraint yet — enforced after backfill is verified.

ALTER TABLE sourcing_requests
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;


-- ─── STEP 2: Backfill org_id values ──────────────────────────────────────────

-- 2a. sourcing_requests: join user_id → org_members to get org_id.
--     Only touches rows where org_id IS NULL — safe to re-run.
UPDATE sourcing_requests sr
SET    org_id = om.org_id
FROM   org_members om
WHERE  om.user_id = sr.user_id
  AND  om.status  = 'active'
  AND  sr.org_id  IS NULL;

-- Verify: run this and confirm 0 rows remain null.
-- SELECT COUNT(*) FROM sourcing_requests WHERE org_id IS NULL;

-- 2b. suppliers: fix the single row missing org_id.
--     Joins the row's user_id to org_members. If user has no active membership,
--     the row stays null — that is safe (user-scoped fallback in existing policy).
UPDATE suppliers s
SET    org_id = om.org_id
FROM   org_members om
WHERE  om.user_id = s.user_id
  AND  om.status  = 'active'
  AND  s.org_id   IS NULL;

-- Verify: should return 0.
-- SELECT COUNT(*) FROM suppliers WHERE org_id IS NULL;


-- ─── STEP 3: Replace sourcing RLS policies ───────────────────────────────────
-- Run ONLY after Step 0 output confirms these policy names match live.
-- IF EXISTS on DROP means a name mismatch is a silent no-op (not a failure).

-- If a DROP is a no-op (wrong name), you will end up with BOTH the old policy
-- AND the new one. Both are permissive and combine with OR — not a security risk,
-- but go back to Supabase dashboard, find the old policy name, and drop it manually.

DROP POLICY IF EXISTS "Users manage own sourcing requests"           ON sourcing_requests;
DROP POLICY IF EXISTS "Users manage images via sourcing request"     ON sourcing_request_images;
DROP POLICY IF EXISTS "Users manage recipients via sourcing request" ON sourcing_request_recipients;
DROP POLICY IF EXISTS "Users read responses via sourcing request"    ON sourcing_request_responses;
DROP POLICY IF EXISTS "Designer manages messages"                    ON sourcing_messages;


-- ── sourcing_requests ─────────────────────────────────────────────────────────
-- Fallback (org_id IS NULL) preserves access for the single user whose requests
-- were created before this migration, in case backfill missed any row.
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
      WHERE  sr.id = sourcing_request_images.sourcing_request_id
        AND  (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE  sr.id = sourcing_request_images.sourcing_request_id
        AND  (
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
      WHERE  sr.id = sourcing_request_recipients.sourcing_request_id
        AND  (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE  sr.id = sourcing_request_recipients.sourcing_request_id
        AND  (
          sr.org_id = get_current_org_id()
          OR (sr.org_id IS NULL AND sr.user_id = auth.uid())
        )
    )
  );

-- ── sourcing_request_responses ────────────────────────────────────────────────
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


-- ─── STEP 4: Post-run verification ───────────────────────────────────────────
-- Run these after the migration and confirm the results.

-- 4a. org_id column exists and is fully backfilled:
SELECT COUNT(*) AS total, COUNT(org_id) AS with_org_id, COUNT(*) - COUNT(org_id) AS null_count
FROM sourcing_requests;
-- Expected: total = with_org_id, null_count = 0

-- 4b. New policies exist:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'sourcing_requests','sourcing_request_images',
    'sourcing_request_recipients','sourcing_request_responses','sourcing_messages'
  )
ORDER BY tablename, policyname;
-- Expected: only the new "Org members manage ..." policies.
-- If you see old policies too (name mismatch on DROP), drop them manually via the
-- Supabase dashboard: Authentication → Policies → select table → delete old policy.

-- 4c. suppliers null row resolved:
SELECT COUNT(*) AS null_count FROM suppliers WHERE org_id IS NULL;
-- Expected: 0


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- Reverts Step 3 only. Step 1 (column) and Step 2 (backfill) are not reversed —
-- the org_id column on sourcing_requests is harmless to leave in place.
-- ═══════════════════════════════════════════════════════════════════════════════

/*
DROP POLICY IF EXISTS "Org members manage sourcing requests"   ON sourcing_requests;
DROP POLICY IF EXISTS "Org members manage sourcing images"     ON sourcing_request_images;
DROP POLICY IF EXISTS "Org members manage sourcing recipients" ON sourcing_request_recipients;
DROP POLICY IF EXISTS "Org members manage sourcing responses"  ON sourcing_request_responses;
DROP POLICY IF EXISTS "Org members manage sourcing messages"   ON sourcing_messages;

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
