-- Payment plan + "Not included in this quote" (per-org feature, first built for
-- CKW Lifestyle, Nov 2026). Off by default, so other studios' quotes are unchanged.
--
-- Settings hold the studio's saved plans and lists (several, e.g. "Design only",
-- "Full service"). A project copies one in and can then be edited for that quote.
-- payment_plan: [{ "label": "On acceptance", "pct": 60 }, ...] adding up to 100.
--   The first stage is the deposit (projects.deposit_percentage is kept equal to it).
-- exclusions: [{ "item": "Additional renders", "price": "R1 500 each" }, ...]
--   Printed under the totals; prices are text and never add to the total.
alter table settings
  add column if not exists payment_plan_enabled boolean not null default false,
  add column if not exists payment_plan_presets jsonb not null default '[]'::jsonb,
  add column if not exists exclusion_presets jsonb not null default '[]'::jsonb;

comment on column settings.payment_plan_enabled is
  'Platform toggle: payment plan stages and "Not included" list on quotes.';

alter table projects
  add column if not exists payment_plan jsonb,
  add column if not exists exclusions jsonb;

-- Locked like the other platform switches (protect_platform_switches.sql).
-- APPLIED 2026-11-19.
