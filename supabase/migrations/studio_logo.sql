-- Studio-specific logo. Run in Supabase SQL Editor.
--
-- A dedicated, higher-resolution logo for Studio's Master Page footer and
-- board covers — separate from settings.logo_url (used across quotes/POs/
-- invoices elsewhere in the app), since that one isn't always clear/high-res
-- enough for a printed A3 presentation. When set, Studio prefers this one;
-- otherwise it falls back to the regular org logo.
alter table settings add column if not exists studio_logo_url text;
