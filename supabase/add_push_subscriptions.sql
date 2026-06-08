-- Push notification subscriptions for staff members
CREATE TABLE IF NOT EXISTS elec_staff_push_subscriptions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id     UUID        NOT NULL REFERENCES elec_staff(id) ON DELETE CASCADE,
  portal_account_id UUID   NOT NULL REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, endpoint)
);

-- Index for fast lookups when sending reminders
CREATE INDEX IF NOT EXISTS idx_push_subs_staff ON elec_staff_push_subscriptions(staff_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_account ON elec_staff_push_subscriptions(portal_account_id);

-- RLS: staff can only manage their own subscriptions
ALTER TABLE elec_staff_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_push_subs_own" ON elec_staff_push_subscriptions
  USING (
    staff_id IN (
      SELECT id FROM elec_staff WHERE auth_user_id = auth.uid()
    )
  );
