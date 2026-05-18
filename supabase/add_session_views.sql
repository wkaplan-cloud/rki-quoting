-- Track when each user last viewed a sourcing session (for "new responses" pill)
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS session_views (
  session_id uuid NOT NULL REFERENCES sourcing_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE session_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own views"
  ON session_views FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Returns the count of suppliers who submitted a price response after
-- the current user last viewed each session.
CREATE OR REPLACE FUNCTION get_session_new_response_counts(p_user_id uuid)
RETURNS TABLE(session_id uuid, new_response_count bigint)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sss.session_id,
    COUNT(DISTINCT sia.session_supplier_id) AS new_response_count
  FROM sourcing_item_responses sir
  JOIN sourcing_item_assignments sia ON sia.id = sir.assignment_id
  JOIN sourcing_session_suppliers sss ON sss.id = sia.session_supplier_id
  LEFT JOIN session_views sv
    ON sv.session_id = sss.session_id AND sv.user_id = p_user_id
  WHERE sir.submitted_at IS NOT NULL
    AND sir.submitted_at > COALESCE(sv.viewed_at, '1970-01-01'::timestamptz)
  GROUP BY sss.session_id;
$$;
