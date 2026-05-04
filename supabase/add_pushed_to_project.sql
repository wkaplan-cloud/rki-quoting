-- Track which project a sourcing item was pushed into as a line item
ALTER TABLE sourcing_session_items
  ADD COLUMN IF NOT EXISTS pushed_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
