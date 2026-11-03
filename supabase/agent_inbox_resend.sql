-- Studio assistant: receive mail at a QuotingHub address instead of a Gmail login.
--
-- Google wouldn't verify another Gmail account on Warren's phone, so the
-- assistant no longer has a mailbox of its own to log into. Each studio's
-- assistant gets an address on Resend's receiving domain instead
-- (mia.<token>@<id>.resend.app); the studio forwards supplier mail there and
-- Resend's email.received webhook delivers it. No password is stored.

-- Test rows from the Gmail build (demo org only).
delete from agent_emails where message_id = 'test-render-1';
delete from agent_mailboxes where email = 'mia.test@example.com';

alter table agent_mailboxes
  drop column if exists app_password_enc,
  drop column if exists last_uid,
  drop column if exists uid_validity,
  add column if not exists inbound_token text;

alter table agent_mailboxes rename column last_checked_at to last_received_at;

create unique index if not exists agent_mailboxes_inbound_token_idx on agent_mailboxes (inbound_token);

comment on column agent_mailboxes.email is
  'The assistant''s receiving address, built from agent_name + inbound_token + RESEND_INBOUND_DOMAIN.';
comment on column agent_mailboxes.inbound_token is
  'Random part of the receiving address; identifies the studio when mail arrives.';

-- Resend message id, so a retried webhook can't file the same email twice
-- even when the sender's Message-ID header is missing.
alter table agent_emails add column if not exists resend_email_id text;
alter table agent_emails drop column if exists imap_uid;
