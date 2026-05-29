-- Designer-portal notifications (org-level, separate from elec_notifications which is supplier-portal only)
CREATE TABLE IF NOT EXISTS org_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  title       text        NOT NULL,
  body        text,
  metadata    jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_notifications_org_id_created_at_idx
  ON org_notifications (org_id, created_at DESC);

ALTER TABLE org_notifications ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's notifications
CREATE POLICY "org members read own notifications" ON org_notifications
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only service role can insert/update (all inserts come from API routes using supabaseAdmin)
CREATE POLICY "service role full access" ON org_notifications
  FOR ALL USING (auth.role() = 'service_role');
