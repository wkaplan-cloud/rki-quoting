-- Editable acceptance block on quote PDFs (designer portal only).
--
-- Until now the heading, wording and the Full Name / Signature / Date rules
-- were hardcoded in all three PDF templates. Studios can now edit each part in
-- Admin → Quote Defaults, or switch the whole block off.
--
-- NULL means "never edited" — the code falls back to the wording that has always
-- printed, so nothing changes for existing studios. An empty string means the
-- studio deliberately cleared that part and it is left off the quote.

alter table settings
  add column if not exists acceptance_enabled          boolean not null default true,
  add column if not exists acceptance_heading          text,
  add column if not exists acceptance_text             text,
  add column if not exists acceptance_signature_labels text;

comment on column settings.acceptance_enabled is
  'Print the acceptance block on quote PDFs.';
comment on column settings.acceptance_heading is
  'Heading above the acceptance wording. NULL = "ACCEPTANCE".';
comment on column settings.acceptance_text is
  'Acceptance paragraph. NULL = the platform default wording.';
comment on column settings.acceptance_signature_labels is
  'Comma-separated signature rule labels, max 4. NULL = "Full Name, Signature, Date".';
