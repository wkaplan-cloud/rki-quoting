-- ─── Sourcing Messages migration ─────────────────────────────────────────────
-- Run in Supabase SQL editor.
-- Adds per-item back-and-forth messaging between designer and supplier.

CREATE TABLE IF NOT EXISTS sourcing_messages (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id uuid        REFERENCES sourcing_request_recipients(id) ON DELETE CASCADE NOT NULL,
  sender_type  text        NOT NULL CHECK (sender_type IN ('designer', 'supplier')),
  body         text        NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE sourcing_messages ENABLE ROW LEVEL SECURITY;

-- Designers can read/write messages on their own requests
CREATE POLICY "Designer manages messages" ON sourcing_messages
  USING (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_messages.recipient_id
         AND sr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM sourcing_request_recipients srr
        JOIN sourcing_requests sr ON sr.id = srr.sourcing_request_id
       WHERE srr.id = sourcing_messages.recipient_id
         AND sr.user_id = auth.uid()
    )
  );

-- Supplier access is token-based, handled server-side via supabaseAdmin.
-- No public RLS policy needed.

CREATE INDEX IF NOT EXISTS sourcing_messages_recipient_created
  ON sourcing_messages (recipient_id, created_at);
