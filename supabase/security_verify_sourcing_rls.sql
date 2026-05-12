-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY VERIFICATION: Sourcing v4 RLS policies
-- Run in Supabase SQL Editor to confirm all policies are in place.
-- This script is IDEMPOTENT — safe to run multiple times.
-- Created after security audit (2026-05-12).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── STEP 1: Confirm RLS is enabled on all sourcing tables ───────────────────
-- Expected: 7 rows, all with rowsecurity = true

SELECT
  relname        AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN (
  'sourcing_sessions',
  'sourcing_session_items',
  'sourcing_item_images',
  'sourcing_session_suppliers',
  'sourcing_item_assignments',
  'sourcing_item_responses',
  'sourcing_thread_messages'
)
ORDER BY relname;


-- ─── STEP 2: List every policy on sourcing tables ────────────────────────────
-- Expected: at minimum 8 policies across 7 tables
-- (sourcing_session_suppliers and sourcing_thread_messages each have 2)

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'sourcing_sessions',
  'sourcing_session_items',
  'sourcing_item_images',
  'sourcing_session_suppliers',
  'sourcing_item_assignments',
  'sourcing_item_responses',
  'sourcing_thread_messages'
)
ORDER BY tablename, policyname;


-- ─── STEP 3: Ensure policies exist — create if missing ───────────────────────
-- These are the canonical policies from sourcing_v4.sql.
-- If any are missing they are re-created here.

-- sourcing_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_sessions'
      AND policyname = 'Org members manage sourcing sessions'
  ) THEN
    CREATE POLICY "Org members manage sourcing sessions" ON sourcing_sessions
      USING  (org_id = get_current_org_id())
      WITH CHECK (org_id = get_current_org_id());
    RAISE NOTICE 'Created missing policy: Org members manage sourcing sessions';
  END IF;
END $$;

-- sourcing_session_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_session_items'
      AND policyname = 'Org members manage session items'
  ) THEN
    CREATE POLICY "Org members manage session items" ON sourcing_session_items
      USING (
        EXISTS (
          SELECT 1 FROM sourcing_sessions ss
           WHERE ss.id = sourcing_session_items.session_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM sourcing_sessions ss
           WHERE ss.id = sourcing_session_items.session_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members manage session items';
  END IF;
END $$;

-- sourcing_item_images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_item_images'
      AND policyname = 'Org members manage item images'
  ) THEN
    CREATE POLICY "Org members manage item images" ON sourcing_item_images
      USING (
        EXISTS (
          SELECT 1
            FROM sourcing_session_items ssi
            JOIN sourcing_sessions ss ON ss.id = ssi.session_id
           WHERE ssi.id = sourcing_item_images.item_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
            FROM sourcing_session_items ssi
            JOIN sourcing_sessions ss ON ss.id = ssi.session_id
           WHERE ssi.id = sourcing_item_images.item_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members manage item images';
  END IF;
END $$;

-- sourcing_session_suppliers — org policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_session_suppliers'
      AND policyname = 'Org members manage session suppliers'
  ) THEN
    CREATE POLICY "Org members manage session suppliers" ON sourcing_session_suppliers
      USING (
        EXISTS (
          SELECT 1 FROM sourcing_sessions ss
           WHERE ss.id = sourcing_session_suppliers.session_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM sourcing_sessions ss
           WHERE ss.id = sourcing_session_suppliers.session_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members manage session suppliers';
  END IF;
END $$;

-- sourcing_session_suppliers — platform supplier self-read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_session_suppliers'
      AND policyname = 'Platform supplier reads own session record'
  ) THEN
    CREATE POLICY "Platform supplier reads own session record" ON sourcing_session_suppliers
      USING (
        portal_account_id IN (
          SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
        )
      );
    RAISE NOTICE 'Created missing policy: Platform supplier reads own session record';
  END IF;
END $$;

-- sourcing_item_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_item_assignments'
      AND policyname = 'Org members manage item assignments'
  ) THEN
    CREATE POLICY "Org members manage item assignments" ON sourcing_item_assignments
      USING (
        EXISTS (
          SELECT 1
            FROM sourcing_session_items ssi
            JOIN sourcing_sessions ss ON ss.id = ssi.session_id
           WHERE ssi.id = sourcing_item_assignments.item_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
            FROM sourcing_session_items ssi
            JOIN sourcing_sessions ss ON ss.id = ssi.session_id
           WHERE ssi.id = sourcing_item_assignments.item_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members manage item assignments';
  END IF;
END $$;

-- sourcing_item_responses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_item_responses'
      AND policyname = 'Org members read item responses'
  ) THEN
    CREATE POLICY "Org members read item responses" ON sourcing_item_responses
      USING (
        EXISTS (
          SELECT 1
            FROM sourcing_item_assignments sia
            JOIN sourcing_session_items ssi ON ssi.id = sia.item_id
            JOIN sourcing_sessions ss       ON ss.id  = ssi.session_id
           WHERE sia.id = sourcing_item_responses.assignment_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
            FROM sourcing_item_assignments sia
            JOIN sourcing_session_items ssi ON ssi.id = sia.item_id
            JOIN sourcing_sessions ss       ON ss.id  = ssi.session_id
           WHERE sia.id = sourcing_item_responses.assignment_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members read item responses';
  END IF;
END $$;

-- sourcing_thread_messages — org policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_thread_messages'
      AND policyname = 'Org members manage thread messages'
  ) THEN
    CREATE POLICY "Org members manage thread messages" ON sourcing_thread_messages
      USING (
        EXISTS (
          SELECT 1
            FROM sourcing_session_suppliers sss
            JOIN sourcing_sessions ss ON ss.id = sss.session_id
           WHERE sss.id = sourcing_thread_messages.session_supplier_id
             AND ss.org_id = get_current_org_id()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
            FROM sourcing_session_suppliers sss
            JOIN sourcing_sessions ss ON ss.id = sss.session_id
           WHERE sss.id = sourcing_thread_messages.session_supplier_id
             AND ss.org_id = get_current_org_id()
        )
      );
    RAISE NOTICE 'Created missing policy: Org members manage thread messages';
  END IF;
END $$;

-- sourcing_thread_messages — platform supplier self policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sourcing_thread_messages'
      AND policyname = 'Platform supplier manages own thread'
  ) THEN
    CREATE POLICY "Platform supplier manages own thread" ON sourcing_thread_messages
      USING (
        EXISTS (
          SELECT 1 FROM sourcing_session_suppliers sss
           WHERE sss.id = sourcing_thread_messages.session_supplier_id
             AND sss.portal_account_id IN (
               SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
             )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM sourcing_session_suppliers sss
           WHERE sss.id = sourcing_thread_messages.session_supplier_id
             AND sss.portal_account_id IN (
               SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
             )
        )
      );
    RAISE NOTICE 'Created missing policy: Platform supplier manages own thread';
  END IF;
END $$;


-- ─── STEP 4: Storage bucket policy guidance ───────────────────────────────────
-- Supabase storage policies must be configured in the Dashboard UI or via
-- storage.objects table policies. The two buckets used by sourcing are:
--
-- sourcing-images (public read, authenticated write)
--   Path pattern: item-refs/{session_id}/{timestamp}-{filename}
--   All application uploads go through the authenticated API route which
--   now verifies session ownership before any supabaseAdmin storage call.
--
-- sourcing-attachments (supplier quote documents)
--   Path pattern: supplier-quotes/{session_supplier_id}/{timestamp}-{filename}
--   Uploads happen through token-authenticated supplier routes only.
--   IMPORTANT: Verify in Supabase Dashboard → Storage → sourcing-attachments
--   that this bucket is NOT set to public. It should require a signed URL
--   or authenticated access for downloads.
--
-- To check current bucket visibility:
SELECT id, name, public FROM storage.buckets
WHERE name IN ('sourcing-images', 'sourcing-attachments');
-- sourcing-images: public = true  (expected — ref images shown to suppliers)
-- sourcing-attachments: public = false (expected — quote docs are private)


-- ─── STEP 5: Verify get_current_org_id() function exists ─────────────────────
-- All RLS policies depend on this function. If it returns NULL, RLS will
-- fail to match any rows (safe — no data exposed) but all queries will
-- silently return empty results.

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_current_org_id'
  AND routine_schema = 'public';
-- Expected: 1 row, routine_type = 'FUNCTION'
