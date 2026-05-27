-- Quote approval/decline flow.
-- One record per project (upserted on each quote send so the token refreshes).

CREATE TABLE IF NOT EXISTS quote_approvals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token           text        NOT NULL UNIQUE,
  decision        text        CHECK (decision IN ('approved', 'declined')),
  comment         text,
  submitted_at    timestamptz,
  client_name     text,
  client_email    text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;

-- Designers can read/manage their own project's approval record.
CREATE POLICY "Users manage their quote approvals" ON quote_approvals
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quote_approvals.project_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quote_approvals.project_id
        AND p.user_id = auth.uid()
    )
  );

-- Add client_approved stage to project_stages.
ALTER TABLE project_stages
  ADD COLUMN IF NOT EXISTS client_approved     boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_approved_at  timestamptz;
