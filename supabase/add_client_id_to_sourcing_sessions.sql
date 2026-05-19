-- Add client_id to sourcing_sessions so price requests can be linked to a client
ALTER TABLE sourcing_sessions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sourcing_sessions_client_id_idx ON sourcing_sessions(client_id);
