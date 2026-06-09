-- COC redesign: add all fields required for the official ECA two-page form.
-- Run this in the Supabase SQL editor. Safe to run multiple times (IF NOT EXISTS).
-- Supersedes add_elec_coc_phase2_columns.sql — run only this one.

-- ── elec_coc ─────────────────────────────────────────────────────────────────

alter table elec_coc
  -- Phase-2 columns (in case phase2 migration was not run yet)
  add column if not exists linked_doc_number        text,
  add column if not exists installation_address     text,
  add column if not exists owner_name               text,
  add column if not exists supply_authority         text,
  add column if not exists supply_voltage           text default '230/400V',
  add column if not exists supply_phases            text default 'three',
  add column if not exists supply_earthing          text default 'TN-C-S',
  add column if not exists main_breaker_amps        text,
  add column if not exists work_type                text default 'new',
  add column if not exists installation_type        text default 'residential',
  add column if not exists earth_continuity         text default 'pass',
  add column if not exists insulation_resistance    text default 'pass',
  add column if not exists polarity                 text default 'pass',
  add column if not exists earth_leakage            text default 'pass',
  add column if not exists overcurrent_protection   text default 'pass',
  add column if not exists phase_rotation           text default 'pass',
  add column if not exists sent_to_name             text,
  add column if not exists sent_to_email            text,
  add column if not exists sent_at                  timestamptz,
  add column if not exists share_token              text,

  -- COC certificate fields
  add column if not exists certificate_type         text default 'initial',
  add column if not exists supplement_no            text,
  add column if not exists to_initial_cert_no       text,
  add column if not exists initial_cert_date        text,
  add column if not exists regulation_type          text default 'a',

  -- Extended location fields
  add column if not exists name_of_building         text,
  add column if not exists suburb_township          text,
  add column if not exists district_town_city       text,
  add column if not exists gps_coordinates          text,
  add column if not exists pole_number              text,
  add column if not exists erf_lot_no               text,

  -- Test report header
  add column if not exists db_supply                text,
  add column if not exists additional_pages         boolean default false,

  -- Registered person (per-COC snapshot, pre-filled from settings)
  add column if not exists reg_person_id_no         text,
  add column if not exists reg_person_reg_date      text,
  add column if not exists reg_person_type          text default 'master',
  add column if not exists reg_person_address       text,
  add column if not exists reg_person_tel           text,
  add column if not exists reg_person_fax           text,
  add column if not exists reg_person_cell          text,
  add column if not exists reg_person_email         text,

  -- Electrical contractor (per-COC snapshot)
  add column if not exists contractor_name          text,
  add column if not exists contractor_id_no         text,
  add column if not exists contractor_reg_no        text,
  add column if not exists contractor_reg_date      text,
  add column if not exists contractor_address       text,
  add column if not exists contractor_tel           text,
  add column if not exists contractor_fax           text,
  add column if not exists contractor_cell          text,
  add column if not exists contractor_email         text,

  -- Recipient
  add column if not exists recipient_name           text,
  add column if not exists recipient_date           text,

  -- All Section 2-4 data (supply system, circuit counts, test readings)
  add column if not exists test_report              jsonb default '{}';

-- ── elec_settings ────────────────────────────────────────────────────────────
-- Default registered person + contractor details (pre-fill all new COCs)

alter table elec_settings
  add column if not exists reg_person_name          text,
  add column if not exists reg_person_id_no         text,
  add column if not exists reg_person_reg_no        text,
  add column if not exists reg_person_reg_date      text,
  add column if not exists reg_person_type          text,
  add column if not exists reg_person_address       text,
  add column if not exists reg_person_tel           text,
  add column if not exists reg_person_fax           text,
  add column if not exists reg_person_cell          text,
  add column if not exists reg_person_email         text,
  add column if not exists contractor_name          text,
  add column if not exists contractor_id_no         text,
  add column if not exists contractor_reg_no        text,
  add column if not exists contractor_reg_date      text,
  add column if not exists contractor_address       text,
  add column if not exists contractor_tel           text,
  add column if not exists contractor_fax           text,
  add column if not exists contractor_cell          text,
  add column if not exists contractor_email         text;
