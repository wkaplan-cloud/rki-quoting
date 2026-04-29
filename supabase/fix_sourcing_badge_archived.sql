-- Fix: exclude archived sessions from the sourcing nav badge count.
-- The original function predates the `archived` column and counts all responded
-- sessions regardless of archive state. Run in Supabase SQL editor.

CREATE OR REPLACE FUNCTION get_sourcing_badge_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ss.id)::integer
  FROM sourcing_sessions ss
  JOIN sourcing_session_items ssi ON ssi.session_id = ss.id
  JOIN sourcing_item_assignments sia ON sia.item_id = ssi.id
  WHERE ss.org_id = p_org_id
    AND ss.archived = false
    AND sia.status = 'responded'
$$;
