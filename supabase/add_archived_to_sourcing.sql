-- Add archived flag to sourcing_requests
ALTER TABLE sourcing_requests
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS sourcing_requests_archived_idx ON sourcing_requests (archived);
