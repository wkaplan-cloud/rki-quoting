-- ─── Phase 2 Features: COC fields, Staff auth, Org members, Time punches, Notifications ───

-- COC extended fields
ALTER TABLE elec_coc
  ADD COLUMN IF NOT EXISTS installation_address   text,
  ADD COLUMN IF NOT EXISTS owner_name             text,
  ADD COLUMN IF NOT EXISTS supply_authority       text,
  ADD COLUMN IF NOT EXISTS supply_voltage         text DEFAULT '230/400V',
  ADD COLUMN IF NOT EXISTS supply_phases          text DEFAULT 'three',
  ADD COLUMN IF NOT EXISTS supply_earthing        text DEFAULT 'TN-C-S',
  ADD COLUMN IF NOT EXISTS main_breaker_amps      text,
  ADD COLUMN IF NOT EXISTS work_type              text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS installation_type      text DEFAULT 'residential',
  ADD COLUMN IF NOT EXISTS earth_continuity       text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS insulation_resistance  text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS polarity               text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS earth_leakage          text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS overcurrent_protection text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS phase_rotation         text DEFAULT 'pass',
  ADD COLUMN IF NOT EXISTS sent_to_name           text,
  ADD COLUMN IF NOT EXISTS sent_to_email          text,
  ADD COLUMN IF NOT EXISTS sent_at                timestamptz,
  ADD COLUMN IF NOT EXISTS share_token            text;

-- Staff: link to Supabase auth for login
ALTER TABLE elec_staff
  ADD COLUMN IF NOT EXISTS auth_user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_token           text,
  ADD COLUMN IF NOT EXISTS invite_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS invite_accepted_at     timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS elec_staff_auth_user_id_key ON elec_staff(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Org members: additional admins per org
CREATE TABLE IF NOT EXISTS portal_org_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id  uuid NOT NULL REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE,
  auth_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email              text NOT NULL,
  name               text,
  role               text NOT NULL DEFAULT 'admin',
  invited_by         uuid REFERENCES auth.users(id),
  invite_token       text,
  invited_at         timestamptz DEFAULT now(),
  accepted_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  UNIQUE(portal_account_id, email)
);

-- Time punches: clock in/out with GPS
CREATE TABLE IF NOT EXISTS elec_time_punches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id  uuid NOT NULL REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE,
  staff_id           uuid NOT NULL REFERENCES elec_staff(id) ON DELETE CASCADE,
  punch_type         text NOT NULL CHECK (punch_type IN ('clock_in', 'clock_out')),
  punched_at         timestamptz NOT NULL DEFAULT now(),
  latitude           double precision,
  longitude          double precision,
  job_id             uuid,
  notes              text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_punches_staff_date ON elec_time_punches(staff_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_punches_account_date ON elec_time_punches(portal_account_id, punched_at DESC);

-- Notifications
CREATE TABLE IF NOT EXISTS elec_notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_account_id  uuid NOT NULL REFERENCES supplier_portal_accounts(id) ON DELETE CASCADE,
  type               text NOT NULL,
  title              text NOT NULL,
  body               text,
  read_at            timestamptz,
  metadata           jsonb DEFAULT '{}',
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_account_unread ON elec_notifications(portal_account_id, created_at DESC) WHERE read_at IS NULL;

-- Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE elec_notifications;
