-- ─── Sourcing Requests feature migration ────────────────────────────────────
-- Run in Supabase SQL editor.
-- Creates the full Sourcing Requests feature schema.

-- 1. Per-studio beta gate on settings ───────────────────────────────────────
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS sourcing_enabled boolean NOT NULL DEFAULT false;

-- 2. sourcing_requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sourcing_requests (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id           uuid        REFERENCES projects(id) ON DELETE SET NULL,
  title                text        NOT NULL,
  specifications       text,
  quantity             numeric     NOT NULL DEFAULT 1,
  unit                 text,
  dimensions           text,
  colour_finish        text,
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','sent','responded','accepted','pushed','cancelled')),
  sent_at              timestamptz,
  accepted_at          timestamptz,
  accepted_response_id uuid,
  pushed_at            timestamptz,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE sourcing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sourcing requests" ON sourcing_requests
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. sourcing_request_images ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sourcing_request_images (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sourcing_request_id  uuid        REFERENCES sourcing_requests(id) ON DELETE CASCADE NOT NULL,
  url                  text        NOT NULL,
  caption              text,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE sourcing_request_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage images via sourcing request" ON sourcing_request_images
  USING (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_images.sourcing_request_id
        AND sr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_images.sourcing_request_id
        AND sr.user_id = auth.uid()
    )
  );

-- 4. sourcing_request_recipients ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sourcing_request_recipients (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sourcing_request_id  uuid        REFERENCES sourcing_requests(id) ON DELETE CASCADE NOT NULL,
  supplier_id          uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name        text        NOT NULL,
  email                text        NOT NULL,
  token                text        NOT NULL UNIQUE,
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','viewed','responded','accepted','rejected','declined')),
  sent_at              timestamptz,
  viewed_at            timestamptz,
  responded_at         timestamptz,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE sourcing_request_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage recipients via sourcing request" ON sourcing_request_recipients
  USING (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_recipients.sourcing_request_id
        AND sr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sourcing_requests sr
      WHERE sr.id = sourcing_request_recipients.sourcing_request_id
        AND sr.user_id = auth.uid()
    )
  );

-- Public supplier access (token-based) is handled server-side via supabaseAdmin.
-- No public RLS policy needed — the API validates the token before exposing data.

-- 5. sourcing_request_responses ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sourcing_request_responses (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id     uuid        REFERENCES sourcing_request_recipients(id) ON DELETE CASCADE NOT NULL,
  unit_price       numeric     NOT NULL,
  lead_time_weeks  integer,
  notes            text,
  valid_until      date,
  submitted_at     timestamptz DEFAULT now()
);

ALTER TABLE sourcing_request_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read responses via sourcing request" ON sourcing_request_responses
  USING (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_request_responses.recipient_id
         AND sr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_request_responses.recipient_id
         AND sr.user_id = auth.uid()
    )
  );

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Create a PUBLIC bucket named "sourcing-images" in the Supabase dashboard.
-- Storage → New bucket → Name: sourcing-images → Public: ON
-- This bucket holds reference images attached to sourcing requests.
-- Supplier pages are public (token-based, no auth), so images must be publicly readable.
