-- Studio RFQ (request-for-quote) tracking on specs.
-- Run manually in the Supabase SQL editor.
--
-- rfq_sent_at: when a quote request email was last sent for this spec.
-- rfq_sent_to: full history of recipients, jsonb array of
--   { "supplierName": string, "email": string, "at": ISO timestamp }
-- Stamped server-side by /api/studio/boards/[id]/rfq — the client's spec
-- autosave upserts an explicit column list, so these are never clobbered.

alter table studio_specs add column if not exists rfq_sent_at timestamptz;
alter table studio_specs add column if not exists rfq_sent_to jsonb not null default '[]'::jsonb;
