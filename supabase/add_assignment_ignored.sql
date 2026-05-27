-- Add ignored flag to sourcing_item_assignments.
-- Allows designers to silence a price response from the nav badge
-- without selecting or rejecting it. The Select button remains visible.

ALTER TABLE sourcing_item_assignments
  ADD COLUMN IF NOT EXISTS ignored boolean NOT NULL DEFAULT false;

-- Update badge count to exclude sessions where every responded
-- assignment has been individually ignored by the designer.
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
    AND sia.ignored = false
$$;
