-- Trial nudge: record when a studio was last nudged about its trial.
--
-- Stored on the organization rather than in a separate table because only the
-- most recent send matters — the platform Studios page shows "Last nudged" so
-- an admin can see at a glance who has already been chased this week.
--
-- Distinct from onboarding_nudges, which tracks the "finish your setup" nudge
-- for auth accounts that never completed onboarding and therefore have no org.

alter table organizations
  add column if not exists trial_nudge_sent_at timestamptz;

comment on column organizations.trial_nudge_sent_at is
  'When a platform admin last sent this studio a trial / trial-expired nudge email.';
