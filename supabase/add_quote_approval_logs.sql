-- Stores one row per client approval/decline decision.
-- Unlike quote_approvals (one row per project, reset on re-send),
-- this table grows over time so the designer has a full audit trail.
CREATE TABLE IF NOT EXISTS quote_approval_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision      text        NOT NULL CHECK (decision IN ('approved', 'declined')),
  comment       text,
  client_name   text,
  client_email  text,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_approval_logs_project_id_idx ON quote_approval_logs(project_id);

-- RLS: project owner can read their own logs
ALTER TABLE quote_approval_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read approval logs"
  ON quote_approval_logs FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
