-- Trial nudge for supplier-portal accounts (manufacturing + electrician/trades).
--
-- Mirrors organizations.trial_nudge_sent_at, which does the same job for design
-- studios: only the most recent send matters, so it is a column rather than a
-- table. The platform Manufacturing / Electricians / All Accounts pages read it
-- to show "Nudged 8 Sep" on the button.

alter table supplier_portal_accounts
  add column if not exists trial_nudge_sent_at timestamptz;

comment on column supplier_portal_accounts.trial_nudge_sent_at is
  'When a platform admin last sent this account a trial / trial-expired nudge email.';
