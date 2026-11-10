-- Mia's "Supplier Prices" Google Sheet (Mia folder / Accounts). Rebuilt from
-- agent_documents after every filing; these record where it is and how the
-- last rebuild went, so a failure shows on her page instead of only in logs.
alter table agent_mailboxes
  add column if not exists sheet_id text,
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists sheet_error text;
