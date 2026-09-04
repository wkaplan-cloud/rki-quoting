-- ─── Job Card Approval, separate from Sign-off ────────────────────────────────
-- A job card collects two different signatures, and they were sharing one field:
--
--   APPROVAL  — the client agreeing to the work before it happens, signed
--               remotely from the emailed link, or recorded by the office when
--               the client approves by phone / WhatsApp / email.
--
--   SIGN-OFF  — the client confirming the work was done, signed on the tech's
--               device on site. That stays in client_signature_url.
--
-- Approval can be manual; sign-off never can — nobody but the client can say
-- the work was done to their satisfaction.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table elec_job_cards
  add column if not exists approval_signature_url text,
  add column if not exists approved_at            timestamptz,
  add column if not exists approved_by            text,
  add column if not exists approval_method        text,
  add column if not exists approval_note          text;

comment on column elec_job_cards.approval_signature_url is
  'Client signature approving the work up front, captured from the emailed link. Null when approval was recorded manually.';
comment on column elec_job_cards.approved_at is
  'When the client approved the work — set by a signed link or a manual record.';
comment on column elec_job_cards.approval_method is
  'signature | phone | whatsapp | email | in_person';
comment on column elec_job_cards.client_signature_url is
  'Client sign-off that the work was done, captured on site. Never set manually.';
