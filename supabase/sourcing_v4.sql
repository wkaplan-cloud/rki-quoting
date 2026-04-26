-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Sourcing v4 — Full rebuild
-- Run in Supabase SQL editor.
--
-- What this does:
--   1. Drops all old sourcing tables (data is test-only, safe to delete)
--   2. Enhances supplier_portal_accounts with profile fields
--   3. Creates the new session-based sourcing schema
--
-- New model:
--   sourcing_sessions           — one RFQ batch per project
--   sourcing_session_items      — individual items within a session
--   sourcing_item_images        — reference images per item
--   sourcing_session_suppliers  — a supplier's involvement in a session (holds magic-link token)
--   sourcing_item_assignments   — which supplier quotes which item (many-to-many)
--   sourcing_item_responses     — a supplier's price for one item
--   sourcing_thread_messages    — one message thread per supplier per session
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── STEP 1: Drop old sourcing tables ────────────────────────────────────────
-- CASCADE handles FK dependencies automatically.

DROP TABLE IF EXISTS sourcing_messages              CASCADE;
DROP TABLE IF EXISTS sourcing_request_responses     CASCADE;
DROP TABLE IF EXISTS sourcing_request_recipients    CASCADE;
DROP TABLE IF EXISTS sourcing_request_images        CASCADE;
DROP TABLE IF EXISTS sourcing_requests              CASCADE;


-- ─── STEP 2: Enhance supplier_portal_accounts ────────────────────────────────
-- Add profile fields for platform supplier discovery.

ALTER TABLE supplier_portal_accounts
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS categories   text[],
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS logo_url     text;


-- ─── STEP 3: sourcing_sessions ───────────────────────────────────────────────
-- Top-level container. One session = one RFQ batch for a project.
-- A designer opens a session, adds items, assigns suppliers, then sends.

CREATE TABLE sourcing_sessions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE  NOT NULL,
  user_id     uuid        REFERENCES auth.users(id)   ON DELETE CASCADE  NOT NULL,
  project_id  uuid        REFERENCES projects(id)     ON DELETE SET NULL,
  title       text        NOT NULL,
  status      text        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','in_progress','completed','archived')),
  archived    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE sourcing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage sourcing sessions" ON sourcing_sessions
  USING  (org_id = get_current_org_id())
  WITH CHECK (org_id = get_current_org_id());

CREATE INDEX sourcing_sessions_org_idx     ON sourcing_sessions (org_id, created_at DESC);
CREATE INDEX sourcing_sessions_project_idx ON sourcing_sessions (project_id);


-- ─── STEP 4: sourcing_session_items ──────────────────────────────────────────
-- Individual items within a session.
-- line_item_id is optional — set when the item is pulled from an existing project line item.

CREATE TABLE sourcing_session_items (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id     uuid        REFERENCES sourcing_sessions(id)  ON DELETE CASCADE  NOT NULL,
  line_item_id   uuid        REFERENCES line_items(id)         ON DELETE SET NULL,
  title          text        NOT NULL,
  work_type      text,
  specifications text,
  item_quantity  integer,
  dimensions     text,
  colour_finish  text,
  status         text        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','accepted','manual')),
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE sourcing_session_items ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX sourcing_session_items_sess_idx ON sourcing_session_items (session_id, sort_order);


-- ─── STEP 5: sourcing_item_images ────────────────────────────────────────────
-- Reference images per item (not per session — each item has its own images).

CREATE TABLE sourcing_item_images (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    uuid        REFERENCES sourcing_session_items(id) ON DELETE CASCADE NOT NULL,
  url        text        NOT NULL,
  caption    text,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sourcing_item_images ENABLE ROW LEVEL SECURITY;

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


-- ─── STEP 6: sourcing_session_suppliers ──────────────────────────────────────
-- A supplier's involvement in a session.
--
-- supplier_id:       studio's own supplier record (optional)
-- portal_account_id: set if the supplier is a registered platform supplier (optional)
--
-- The token is the magic link key — unregistered suppliers use this to access
-- their public response page without logging in. One token per supplier per session
-- means one email, one link, all their assigned items in one place.

CREATE TABLE sourcing_session_suppliers (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        uuid        REFERENCES sourcing_sessions(id)          ON DELETE CASCADE NOT NULL,
  supplier_id       uuid        REFERENCES suppliers(id)                  ON DELETE SET NULL,
  portal_account_id uuid        REFERENCES supplier_portal_accounts(id)   ON DELETE SET NULL,
  supplier_name     text        NOT NULL,
  email             text        NOT NULL,
  token             text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','viewed','in_progress','completed','declined')),
  sent_at           timestamptz,
  viewed_at         timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE sourcing_session_suppliers ENABLE ROW LEVEL SECURITY;

-- Designers manage their session suppliers
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

-- Registered platform suppliers can read their own session records
CREATE POLICY "Platform supplier reads own session record" ON sourcing_session_suppliers
  USING (
    portal_account_id IN (
      SELECT id FROM supplier_portal_accounts WHERE auth_user_id = auth.uid()
    )
  );

CREATE INDEX sourcing_session_supp_sess_idx  ON sourcing_session_suppliers (session_id);
CREATE INDEX sourcing_session_supp_token_idx ON sourcing_session_suppliers (token);


-- ─── STEP 7: sourcing_item_assignments ───────────────────────────────────────
-- Many-to-many: which supplier quotes on which item.
-- A single item can be assigned to multiple suppliers simultaneously (for comparison).
-- A single supplier can be assigned to multiple items in the same session.

CREATE TABLE sourcing_item_assignments (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id             uuid        REFERENCES sourcing_session_items(id)     ON DELETE CASCADE NOT NULL,
  session_supplier_id uuid        REFERENCES sourcing_session_suppliers(id) ON DELETE CASCADE NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','responded','accepted','declined','manual')),
  responded_at        timestamptz,
  accepted_at         timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (item_id, session_supplier_id)
);

ALTER TABLE sourcing_item_assignments ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX sourcing_item_assign_item_idx ON sourcing_item_assignments (item_id);
CREATE INDEX sourcing_item_assign_supp_idx ON sourcing_item_assignments (session_supplier_id);


-- ─── STEP 8: sourcing_item_responses ─────────────────────────────────────────
-- A supplier's price quote for one specific item.
-- One response per assignment (UNIQUE on assignment_id).
-- Suppliers can update their response until the item is accepted.

CREATE TABLE sourcing_item_responses (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id  uuid        REFERENCES sourcing_item_assignments(id) ON DELETE CASCADE NOT NULL UNIQUE,
  unit_price     numeric     NOT NULL,
  fabric_quantity numeric,
  fabric_unit    text,
  lead_time_weeks integer,
  valid_until    date,
  notes          text,
  attachment_url text,
  submitted_at   timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE sourcing_item_responses ENABLE ROW LEVEL SECURITY;

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


-- ─── STEP 9: sourcing_thread_messages ────────────────────────────────────────
-- One conversation thread per supplier per session.
-- session_supplier_id is the thread identifier — all messages between the studio
-- and this supplier for this session live here, regardless of which item they discuss.

CREATE TABLE sourcing_thread_messages (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_supplier_id uuid        REFERENCES sourcing_session_suppliers(id) ON DELETE CASCADE NOT NULL,
  sender_type         text        NOT NULL CHECK (sender_type IN ('designer','supplier')),
  body                text        NOT NULL,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE sourcing_thread_messages ENABLE ROW LEVEL SECURITY;

-- Designers read/write messages on their sessions
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

-- Registered platform suppliers read/write their own thread
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

CREATE INDEX sourcing_thread_msg_supp_idx ON sourcing_thread_messages (session_supplier_id, created_at);


-- ─── STEP 10: Verify ─────────────────────────────────────────────────────────
-- Run after the migration to confirm all tables exist.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sourcing_sessions',
    'sourcing_session_items',
    'sourcing_item_images',
    'sourcing_session_suppliers',
    'sourcing_item_assignments',
    'sourcing_item_responses',
    'sourcing_thread_messages'
  )
ORDER BY table_name;
-- Expected: 7 rows


-- ─── STORAGE ─────────────────────────────────────────────────────────────────
-- Reuse the existing "sourcing-images" bucket (already public).
-- New path pattern: {org_id}/{session_id}/{item_id}/{filename}
-- No bucket changes needed if it already exists.
