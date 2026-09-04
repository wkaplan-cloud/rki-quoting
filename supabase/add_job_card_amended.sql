-- ─── Job Card Amendments ──────────────────────────────────────────────────────
-- A job card that has been sent to the client, or signed off by them, is a
-- record of something agreed. If the office edits it afterwards, the client's
-- copy no longer matches and any signature on it no longer covers what the card
-- now says — so the card is stamped as amended until it is sent again.
--
-- Cleared whenever the card is re-sent or freshly signed.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table elec_job_cards
  add column if not exists amended_at timestamptz;

comment on column elec_job_cards.amended_at is
  'Set when the card is edited after being sent or signed; cleared on resend or new signature.';
