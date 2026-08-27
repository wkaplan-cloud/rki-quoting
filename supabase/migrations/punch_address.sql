-- Store the reverse-geocoded street address alongside the GPS fix on each punch.
-- Written once at clock-in/clock-out so the timesheet (screen, print, email) never
-- has to hit a geocoding service at render time.
-- Run manually in the Supabase SQL editor.

ALTER TABLE elec_time_punches ADD COLUMN IF NOT EXISTS address text;

COMMENT ON COLUMN elec_time_punches.address IS
  'Reverse-geocoded label for (latitude, longitude), resolved at punch time. Null for punches with no GPS fix, or where the lookup failed — backfill with scripts/backfill-punch-addresses.mjs.';
