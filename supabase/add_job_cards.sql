-- ─── Job Cards ────────────────────────────────────────────────────────────────

CREATE TABLE elec_job_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id   uuid NOT NULL REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE,
  quote_id            uuid REFERENCES elec_quotes(id) ON DELETE SET NULL,
  staff_id            uuid REFERENCES elec_staff(id) ON DELETE SET NULL,
  client_id           uuid REFERENCES elec_clients(id) ON DELETE SET NULL,
  job_number          text NOT NULL,
  job_type            text NOT NULL CHECK (job_type IN ('maintenance','repair','once_off','callout')),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  title               text NOT NULL,
  location            text,
  scheduled_at        timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  work_description    text,
  work_found          text,
  work_done           text,
  resolution          text,
  notes               text,
  client_name         text,
  client_email        text,
  client_signature_url text,
  sent_to_name        text,
  sent_to_email       text,
  sent_at             timestamptz,
  share_token         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON elec_job_cards (portal_account_id);
CREATE INDEX ON elec_job_cards (staff_id);
CREATE INDEX ON elec_job_cards (status);

-- ─── Job Card Materials ───────────────────────────────────────────────────────

CREATE TABLE elec_job_card_materials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES elec_job_cards(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty         numeric NOT NULL DEFAULT 1,
  unit_price  numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON elec_job_card_materials (job_card_id);

-- ─── Job Card Photos ──────────────────────────────────────────────────────────

CREATE TABLE elec_job_card_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES elec_job_cards(id) ON DELETE CASCADE,
  url         text NOT NULL,
  caption     text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON elec_job_card_photos (job_card_id);

-- ─── Storage bucket for photos + signatures ───────────────────────────────────
-- Run in Supabase dashboard → Storage → New bucket:
--   name: job-card-photos
--   public: true
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-card-photos', 'job-card-photos', true)
ON CONFLICT DO NOTHING;

-- Allow authenticated users in same org to read/write
CREATE POLICY "job_card_photos_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'job-card-photos');

CREATE POLICY "job_card_photos_select" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'job-card-photos');

CREATE POLICY "job_card_photos_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'job-card-photos');
