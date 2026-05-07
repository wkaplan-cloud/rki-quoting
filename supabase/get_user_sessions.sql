-- Function for the sessions API route to read auth.sessions
-- Run this once in the Supabase SQL editor
CREATE OR REPLACE FUNCTION get_user_sessions_admin(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz
)
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE sql
AS $$
  SELECT id, created_at, updated_at, not_after
  FROM auth.sessions
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC;
$$;
