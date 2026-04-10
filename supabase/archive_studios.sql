-- Add archive support to organizations table
-- Run this in Supabase SQL editor

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations (status);
