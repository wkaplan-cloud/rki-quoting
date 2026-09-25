#!/usr/bin/env node
/**
 * Seeds a fully-populated demo INSTALLER portal account (home automation,
 * AV, CCTV, networking) for sales demos.
 *
 * Usage:
 *   node scripts/seed-installer-demo.mjs
 *
 * Needs supabase/installer_phase1.sql to have been run — it checks first.
 * Safe to re-run — it wipes and rebuilds this demo account's data only.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Prices in here are illustrative demo figures, not anyone's real price list.
 */

import { readFileSync } from 'fs'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ─── env ──────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env vars in .env.local'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Checks a password without touching it. Used so re-runs never revoke live sessions.
async function passwordWorks(email, password) {
  const anon = createClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await anon.auth.signInWithPassword({ email, password })
  return !error
}

// Mirrors src/lib/staff-auth.ts
const STAFF_SALT = env.STAFF_PIN_SALT ?? 'qh_staff_pin_default_salt_2024'
const hashStaffPin      = pin => crypto.createHmac('sha256', STAFF_SALT).update(pin).digest('hex')
const staffAuthEmail    = u   => `staff_${u.toLowerCase()}@staff.quotinghub`
const staffAuthPassword = pin => `${pin}${STAFF_SALT}`

// Mirrors src/lib/sage-crypto.ts, so device passwords are stored the way the app reads them.
function encryptSecret(plaintext) {
  const hex = env.SAGE_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('SAGE_ENCRYPTION_KEY missing from .env.local')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`
}

// ─── demo identity ────────────────────────────────────────────────────────────
const EMAIL    = 'demo-installer@quotinghub.co.za'
const PASSWORD = 'InstallDemo2026!'
const COMPANY  = 'Haven Smart Homes (Demo)'
const CODE     = 'HAV'
const YEAR     = new Date().getFullYear()
const DEPOSIT  = 60

// ─── date helpers ─────────────────────────────────────────────────────────────
const DAY = 86400000
const today = new Date(); today.setHours(0, 0, 0, 0)
const iso   = d => new Date(d).toISOString()
const ymd   = d => new Date(d).toISOString().slice(0, 10)
const daysAgo   = n => new Date(today.getTime() - n * DAY)
const daysAhead = n => new Date(today.getTime() + n * DAY)
const monthStart = offset => { const d = new Date(today.getFullYear(), today.getMonth() + offset, 1); return ymd(d) }
const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return iso(x) }
const round2 = n => Math.round(n * 100) / 100

// ═════════════════════════════════════════════════════════════════════════════
// DEMO CONTENT
// ═════════════════════════════════════════════════════════════════════════════

const STAFF = [
  { name: 'Noah Pillay',      role: 'project_manager', phone: '082 510 3341', color: '#1F5C45', username: 'havnoah',     pin: '2101' },
  { name: 'Kyle Jacobs',      role: 'programmer',      phone: '083 771 2045', color: '#B7862F', username: 'havkyle',     pin: '2102' },
  { name: 'Thandeka Zulu',    role: 'technician',      phone: '072 418 9920', color: '#0891B2', username: 'havthandeka', pin: '2103' },
  { name: 'Pieter Nel',       role: 'installer',       phone: '076 233 5187', color: '#7C3AED', username: 'havpieter',   pin: '2104' },
  { name: 'Musa Khumalo',     role: 'installer',       phone: '081 902 6634', color: '#DC2626', username: 'havmusa',     pin: '2105' },
  { name: 'Aisha Davids',     role: 'admin',           phone: '084 356 1178', color: '#64748B', username: 'havaisha',    pin: '2106' },
]

const CLIENTS = [
  { key: 'dunkeld',   client_name: 'Daniel & Leah Morgenstern', company: null, email: 'daniel.morgenstern@example.co.za', contact_number: '082 614 2290', vat_number: null, address: '23 Bompas Road, Dunkeld, Johannesburg, 2196', payment_terms_days: 7, qs_name: null, qs_email: null, notes: 'New build. Architect: Studio Brenner. Site meetings Tuesdays.' },
  { key: 'waterfall', client_name: 'Kagiso Molefe',             company: null, email: 'kagiso.molefe@example.co.za',      contact_number: '083 402 7715', vat_number: null, address: '14 Kikuyu Close, Waterfall Country Estate, Midrand, 1685', payment_terms_days: 7, qs_name: null, qs_email: null, notes: 'Estate requires contractor gate passes 48h ahead.' },
  { key: 'houghton',  client_name: 'The Houghton Rose Hotel',   company: 'Houghton Rose Hospitality (Pty) Ltd', email: 'gm@houghtonrose.example.co.za', contact_number: '011 483 2210', vat_number: '4820119934', address: '6 Houghton Drive, Houghton Estate, Johannesburg, 2198', payment_terms_days: 30, qs_name: null, qs_email: null, notes: 'Boutique hotel, 18 rooms. Work only between 10:00 and 15:00.' },
  { key: 'parkhurst', client_name: 'Megan Fourie',              company: null, email: 'megan.fourie@example.co.za',       contact_number: '072 559 8103', vat_number: null, address: '8 Fourth Avenue, Parkhurst, Johannesburg, 2193', payment_terms_days: 7, qs_name: null, qs_email: null, notes: 'Converting the spare room into a cinema.' },
  { key: 'rosebank',  client_name: 'Arcadia Capital',           company: 'Arcadia Capital (Pty) Ltd', email: 'facilities@arcadiacap.example.co.za', contact_number: '011 268 4400', vat_number: '4390227781', address: '3rd Floor, 15 Baker Street, Rosebank, 2196', payment_terms_days: 30, qs_name: null, qs_email: null, notes: 'Boardroom and two meeting rooms.' },
  { key: 'sandhurst', client_name: 'Ravi & Priya Naidoo',       company: null, email: 'ravi.naidoo@example.co.za',        contact_number: '082 117 6624', vat_number: null, address: '41 Oxford Road, Sandhurst, Sandton, 2196', payment_terms_days: 7, qs_name: null, qs_email: null, notes: 'Existing Control4 system, installed 2022. On a monthly support plan.' },
]

// Catalogue: [sku, brand, description, category, unit, cost, markup, usage]
const CATALOGUE = [
  ['C4-CORE3',      'Control4',  'CORE 3 controller',                              'Control & Automation', 'nr', 11800, 35, 14],
  ['C4-CORE5',      'Control4',  'CORE 5 controller',                              'Control & Automation', 'nr', 21400, 35, 6],
  ['C4-HALO',       'Control4',  'Halo touch remote',                              'Control & Automation', 'nr', 6900,  35, 12],
  ['C4-T4-8',       'Control4',  'T4 8" in-wall touch screen',                     'Control & Automation', 'nr', 14200, 35, 7],
  ['C4-KP-6',       'Control4',  'Contemporary keypad, 6 button',                  'Control & Automation', 'nr', 3150,  40, 22],
  ['C4-DIM',        'Control4',  'Adaptive phase dimmer',                          'Control & Automation', 'nr', 2380,  40, 25],
  ['C4-SW',         'Control4',  'Configurable decora switch',                     'Control & Automation', 'nr', 1890,  40, 18],
  ['C4-4SIGHT',     'Control4',  '4Sight remote access subscription, 12 months',   'Control & Automation', 'nr', 1650,  30, 9],
  ['SON-ARC',       'Sonos',     'Arc soundbar',                                   'Audio',                'nr', 13200, 25, 8],
  ['SON-SUB',       'Sonos',     'Sub (Gen 3)',                                    'Audio',                'nr', 11400, 25, 6],
  ['SON-AMP',       'Sonos',     'Amp, 2 x 125W',                                  'Audio',                'nr', 9800,  25, 15],
  ['SON-ERA100',    'Sonos',     'Era 100 speaker',                                'Audio',                'nr', 3900,  25, 10],
  ['EP-CW800',      'Episode',   'In-ceiling speaker 8", pair',                    'Audio',                'pr', 4650,  35, 17],
  ['EP-OD650',      'Episode',   'Outdoor speaker 6.5", pair',                     'Audio',                'pr', 5400,  35, 5],
  ['TRI-SUB',       'Triad',     'In-wall subwoofer c/w amplifier',                'Audio',                'nr', 18900, 30, 3],
  ['DEN-X3800',     'Denon',     'AV receiver 9.4 channel',                        'Video & Displays',     'nr', 31500, 25, 4],
  ['EPS-LS12000',   'Epson',     '4K laser projector',                             'Video & Displays',     'nr', 72000, 20, 2],
  ['SCR-120',       'Screen Innovations', 'Fixed frame screen 120", acoustically transparent', 'Video & Displays', 'nr', 26800, 25, 2],
  ['LG-OLED65',     'LG',        '65" OLED display',                               'Video & Displays',     'nr', 33900, 15, 5],
  ['MNT-ART',       'Sanus',     'Articulating TV wall mount',                     'Video & Displays',     'nr', 2450,  40, 11],
  ['UBQ-UDM-PRO',   'Ubiquiti',  'UniFi Dream Machine Pro gateway',                'Networking & Wi-Fi',   'nr', 8900,  30, 13],
  ['UBQ-USW-24P',   'Ubiquiti',  'UniFi 24-port PoE switch',                       'Networking & Wi-Fi',   'nr', 9600,  30, 11],
  ['UBQ-U6-PRO',    'Ubiquiti',  'UniFi U6 Pro access point',                      'Networking & Wi-Fi',   'nr', 3450,  35, 29],
  ['UBQ-U6-MESH',   'Ubiquiti',  'UniFi U6 Mesh outdoor access point',             'Networking & Wi-Fi',   'nr', 3950,  35, 8],
  ['HIK-4MP-TUR',   'Hikvision', '4MP AcuSense turret camera',                     'CCTV & Security',      'nr', 1780,  40, 31],
  ['HIK-8MP-BUL',   'Hikvision', '8MP ColorVu bullet camera',                      'CCTV & Security',      'nr', 2940,  40, 12],
  ['HIK-NVR-8',     'Hikvision', '8-channel PoE NVR',                              'CCTV & Security',      'nr', 4280,  35, 14],
  ['HDD-4TB',       'WD',        'Purple surveillance drive 4TB',                  'CCTV & Security',      'nr', 2150,  30, 14],
  ['2N-IP-VERSO',   '2N',        'IP Verso intercom, 1 button c/w camera',         'CCTV & Security',      'nr', 14500, 30, 4],
  ['RACK-12U',      'Middle Atlantic', '12U wall-mount equipment rack',            'Racks & Power',        'nr', 5600,  30, 9],
  ['UPS-1500',      'APC',       'Smart-UPS 1500VA rack mount',                    'Racks & Power',        'nr', 11200, 25, 8],
  ['PDU-8',         'Furman',    'Power conditioner, 8 outlet',                    'Racks & Power',        'nr', 3900,  30, 7],
  ['CAT6-305',      'Molex',     'Cat6 U/UTP cable, 305m box',                     'Cabling & Accessories','box', 3350, 30, 16],
  ['SPK-CBL-100',   'Van Damme', 'Speaker cable 2-core 2.5mm², 100m',              'Cabling & Accessories','roll', 2100, 30, 10],
  ['HDMI-FIBRE-15', 'Kordz',     'HDMI fibre cable 15m',                           'Cabling & Accessories','nr', 2650,  35, 6],
  ['LAB-PREWIRE',   null,        'First-fix pre-wire, per point',                  'Labour & Programming', 'nr', 380,   60, 24],
  ['LAB-INSTALL',   null,        'Installation technician, per hour',              'Labour & Programming', 'hr', 420,   55, 30],
  ['LAB-PROG',      null,        'Control4 programming, per hour',                 'Labour & Programming', 'hr', 550,   60, 26],
  ['LAB-RACK',      null,        'Rack build, dressing and labelling',             'Labour & Programming', 'lot', 3200, 50, 9],
  ['LAB-COMMISSION',null,        'Commissioning and client handover',              'Labour & Programming', 'lot', 2400, 50, 11],
]

const cat = new Map(CATALOGUE.map(([sku, brand, description, category, unit, cost, markup]) =>
  [sku, { sku, brand, description, category, unit, cost, markup }]))

// A quote line from the catalogue: brand name leads the description, as it
// reads on the client's quote.
const L = (sku, qty, opts = {}) => {
  const c = cat.get(sku)
  if (!c) throw new Error(`Unknown SKU in demo data: ${sku}`)
  const markup = opts.markup ?? c.markup
  return {
    description: c.brand ? `${c.brand} ${c.description}` : c.description,
    unit: c.unit, quoted_quantity: qty, cost_unit_rate: c.cost, markup_percentage: markup,
    quoted_unit_rate: round2(c.cost * (1 + markup / 100)),
    item_type: c.category === 'Labour & Programming' ? 'labour' : 'material',
    is_optional: !!opts.optional, optional_selected: !!opts.taken,
  }
}

const KITS = [
  { name: 'Control4 Starter — one room', description: 'Controller, remote and keypad with programming', items: [
    ['C4-CORE3', 1], ['C4-HALO', 1], ['C4-KP-6', 1], ['C4-4SIGHT', 1], ['LAB-PROG', 4], ['LAB-COMMISSION', 1] ] },
  { name: '4-Camera CCTV', description: '4MP AI turrets, 8-channel NVR, 4TB storage', items: [
    ['HIK-4MP-TUR', 4], ['HIK-NVR-8', 1], ['HDD-4TB', 1], ['CAT6-305', 1], ['LAB-INSTALL', 8] ] },
  { name: 'Cinema Room 5.1', description: 'Projector, AT screen, AV receiver, in-ceiling surrounds', items: [
    ['EPS-LS12000', 1], ['SCR-120', 1], ['DEN-X3800', 1], ['EP-CW800', 3], ['TRI-SUB', 1], ['HDMI-FIBRE-15', 1], ['LAB-INSTALL', 12], ['LAB-PROG', 3] ] },
  { name: 'Whole-home Wi-Fi — 3 access points', description: 'UniFi gateway, PoE switch and three U6 Pros', items: [
    ['UBQ-UDM-PRO', 1], ['UBQ-USW-24P', 1], ['UBQ-U6-PRO', 3], ['LAB-PREWIRE', 3], ['LAB-INSTALL', 5] ] },
  { name: 'Multi-room audio zone', description: 'Sonos Amp driving a pair of in-ceiling speakers', items: [
    ['SON-AMP', 1], ['EP-CW800', 1], ['SPK-CBL-100', 1], ['LAB-PREWIRE', 2], ['LAB-INSTALL', 2] ] },
]

const QUOTES = [
  {
    key: 'dunkeld', client: 'dunkeld', status: 'quoted',
    project_name: 'Dunkeld Residence — Full Smart Home',
    project_address: '23 Bompas Road, Dunkeld',
    project_type: 'residential', quoted_date: ymd(daysAgo(4)), expected_completion_date: ymd(daysAhead(75)),
    notes: 'Pricing valid for 14 days. Equipment is ordered on receipt of the deposit.',
    sections: [
      { title: 'Rack & Network', items: [ L('RACK-12U', 1), L('UPS-1500', 1), L('PDU-8', 1), L('UBQ-UDM-PRO', 1), L('UBQ-USW-24P', 1), L('UBQ-U6-PRO', 4), L('CAT6-305', 3), L('LAB-RACK', 1) ] },
      { title: 'Lounge', items: [ L('C4-CORE5', 1), L('C4-HALO', 1), L('LG-OLED65', 1), L('MNT-ART', 1), L('SON-ARC', 1), L('SON-SUB', 1), L('C4-KP-6', 2), L('C4-DIM', 6) ] },
      { title: 'Main Bedroom', items: [ L('C4-KP-6', 2), L('C4-DIM', 4), L('SON-AMP', 1), L('EP-CW800', 1) ] },
      { title: 'Kitchen & Patio', items: [ L('C4-T4-8', 1), L('SON-AMP', 1), L('EP-CW800', 1), L('EP-OD650', 1, { optional: true }), L('UBQ-U6-MESH', 1, { optional: true }) ] },
      { title: 'Driveway & Perimeter', items: [ L('HIK-8MP-BUL', 4), L('HIK-4MP-TUR', 2), L('HIK-NVR-8', 1), L('HDD-4TB', 2), L('2N-IP-VERSO', 1, { optional: true }) ] },
      { title: 'Labour & Programming', items: [ L('LAB-PREWIRE', 46), L('LAB-INSTALL', 32), L('LAB-PROG', 18), L('LAB-COMMISSION', 1), L('C4-4SIGHT', 1) ] },
    ],
  },
  {
    key: 'waterfall', client: 'waterfall', status: 'in_progress',
    project_name: 'Waterfall Estate — CCTV, Intercom & Wi-Fi',
    project_address: '14 Kikuyu Close, Waterfall Country Estate',
    project_type: 'residential', quoted_date: ymd(daysAgo(38)), approved_date: ymd(daysAgo(31)), expected_completion_date: ymd(daysAhead(9)),
    sections: [
      { title: 'Perimeter CCTV', items: [ L('HIK-8MP-BUL', 6), L('HIK-4MP-TUR', 3), L('HIK-NVR-8', 1), L('HDD-4TB', 2) ] },
      { title: 'Gate & Intercom', items: [ L('2N-IP-VERSO', 1) ] },
      { title: 'Wi-Fi', items: [ L('UBQ-UDM-PRO', 1), L('UBQ-USW-24P', 1), L('UBQ-U6-PRO', 3), L('UBQ-U6-MESH', 1) ] },
      { title: 'Labour', items: [ L('LAB-PREWIRE', 14), L('LAB-INSTALL', 22), L('LAB-COMMISSION', 1) ] },
    ],
    claims: [
      { pct: DEPOSIT, status: 'paid', claim_date: ymd(daysAgo(31)), period: monthStart(-1), notes: `Deposit — ${DEPOSIT}% on acceptance` },
      { pct: 25, status: 'submitted', claim_date: ymd(daysAgo(3)), period: monthStart(0), notes: 'Cameras and NVR installed, Wi-Fi commissioned.' },
    ],
  },
  {
    key: 'houghton', client: 'houghton', status: 'completed',
    project_name: 'Houghton Rose Hotel — Guest Wi-Fi & Lobby Audio',
    project_address: '6 Houghton Drive, Houghton Estate',
    project_type: 'commercial', quoted_date: ymd(daysAgo(120)), approved_date: ymd(daysAgo(112)), expected_completion_date: ymd(daysAgo(70)),
    sections: [
      { title: 'Guest Wi-Fi', items: [ L('UBQ-UDM-PRO', 1), L('UBQ-USW-24P', 2), L('UBQ-U6-PRO', 14), L('CAT6-305', 6) ] },
      { title: 'Lobby & Restaurant Audio', items: [ L('SON-AMP', 3), L('EP-CW800', 6) ] },
      { title: 'Labour', items: [ L('LAB-PREWIRE', 30), L('LAB-INSTALL', 40), L('LAB-RACK', 1), L('LAB-COMMISSION', 1) ] },
    ],
    claims: [
      { pct: DEPOSIT, status: 'paid', claim_date: ymd(daysAgo(112)), period: monthStart(-4), notes: `Deposit — ${DEPOSIT}% on acceptance` },
      { pct: 40,      status: 'paid', claim_date: ymd(daysAgo(72)),  period: monthStart(-2), notes: 'Final — installation complete and handed over.' },
    ],
  },
  {
    key: 'parkhurst', client: 'parkhurst', status: 'draft',
    project_name: 'Parkhurst — Cinema Room',
    project_address: '8 Fourth Avenue, Parkhurst',
    project_type: 'residential', quoted_date: ymd(daysAgo(0)),
    sections: [
      // Good / better / best: the client picks one cinema package.
      { title: 'Good — 5.1 with a 65" OLED', option_group: 'Cinema package', items: [ L('LG-OLED65', 1), L('MNT-ART', 1), L('DEN-X3800', 1), L('EP-CW800', 2), L('SON-SUB', 1) ] },
      { title: 'Better — 5.1 laser projector and 120" screen', option_group: 'Cinema package', option_chosen: true, items: [ L('EPS-LS12000', 1), L('SCR-120', 1), L('DEN-X3800', 1), L('EP-CW800', 3), L('TRI-SUB', 1), L('HDMI-FIBRE-15', 1) ] },
      { title: 'Best — 7.2 laser projector with Control4 automation', option_group: 'Cinema package', items: [ L('EPS-LS12000', 1), L('SCR-120', 1), L('DEN-X3800', 1), L('EP-CW800', 4), L('TRI-SUB', 2), L('HDMI-FIBRE-15', 1), L('C4-CORE3', 1), L('C4-HALO', 1) ] },
      { title: 'Extras', items: [ L('C4-CORE3', 1, { optional: true }), L('C4-HALO', 1, { optional: true }) ] },
      { title: 'Labour & Programming', items: [ L('LAB-INSTALL', 12), L('LAB-PROG', 3) ] },
    ],
  },
  {
    key: 'rosebank', client: 'rosebank', status: 'quoted',
    project_name: 'Arcadia Capital — Boardroom AV',
    project_address: '3rd Floor, 15 Baker Street, Rosebank',
    project_type: 'commercial', quoted_date: ymd(daysAgo(9)), expected_completion_date: ymd(daysAhead(30)),
    deposit: 50,
    sections: [
      { title: 'Boardroom', items: [ L('LG-OLED65', 2), L('MNT-ART', 2), L('C4-CORE3', 1), L('C4-T4-8', 1), L('SON-AMP', 1), L('EP-CW800', 2) ] },
      { title: 'Labour & Programming', items: [ L('LAB-INSTALL', 10), L('LAB-PROG', 6), L('LAB-COMMISSION', 1) ] },
    ],
  },
]

const JOB_CARDS = [
  { job_type: 'callout',     status: 'completed',   client: 'sandhurst', coverage: 'covered', title: 'Halo remote not controlling the lounge TV', location: '41 Oxford Road, Sandhurst', staff: 'Thandeka Zulu', days_ago: 2, work_description: 'Client reports the remote shows the TV but nothing happens.', work_found: 'TV firmware update changed its IR codes; driver no longer matched.', resolution: 'Updated the TV driver in Composer, re-tested all sources, refreshed the remote. Walked the client through it.', callout_fee: 950, labour_hours: 1.5, labour_rate: 650, invoiced: true, materials: [] },
  { job_type: 'repair',      status: 'completed',   client: 'waterfall', title: 'Driveway camera offline', location: '14 Kikuyu Close, Waterfall', staff: 'Pieter Nel', days_ago: 6, work_description: 'Camera 3 shows no signal on the NVR.', work_found: 'Water in the RJ45 junction behind the camera.', resolution: 'Re-terminated with a weatherproof gland and dielectric grease; camera back online, recording checked.', callout_fee: 950, labour_hours: 2, labour_rate: 650, invoiced: false, materials: [ { description: 'Weatherproof RJ45 junction box', qty: 1, cost_price: 180, unit_price: 290 } ] },
  { job_type: 'maintenance', status: 'completed',   client: 'houghton',  coverage: 'covered', title: 'Quarterly network health check', location: 'Houghton Rose Hotel', staff: 'Kyle Jacobs', days_ago: 12, work_description: 'Support plan quarterly visit: firmware, backups, Wi-Fi survey.', work_found: 'Two access points on old firmware, room 14 signal weak.', resolution: 'Updated all firmware, backed up the controller config, moved AP-7 channel. Report sent to GM.', callout_fee: 0, labour_hours: 3, labour_rate: 650, invoiced: true, materials: [] },
  { job_type: 'callout',     status: 'in_progress', client: 'sandhurst', coverage: 'covered', title: 'Sonos dropping out in the main bedroom', location: '41 Oxford Road, Sandhurst', staff: 'Thandeka Zulu', days_ago: 0, work_description: 'Music cuts out every few minutes in the main bedroom.', work_found: 'Amp sitting on a congested 2.4GHz channel — investigating wiring the amp.', resolution: null, callout_fee: 950, labour_rate: 650, materials: [] },
  { job_type: 'once_off',    status: 'pending',     client: 'dunkeld',   title: 'Site walk-through with the electrician', location: '23 Bompas Road, Dunkeld', staff: 'Noah Pillay', days_ahead: 2, work_description: 'Mark up conduit and back-box positions for pre-wire before the plasterers start.', callout_fee: 0, labour_rate: 650, materials: [] },
  { job_type: 'once_off',    status: 'completed',   client: 'sandhurst', coverage: 'billable', title: 'Add outdoor speakers to the pool deck', location: '41 Oxford Road, Sandhurst', staff: 'Pieter Nel', days_ago: 40, work_description: 'Client asked for a pair of outdoor speakers on the existing patio amp.', work_found: 'Spare zone on the patio Sonos Amp.', resolution: 'Installed and tuned a pair of Episode outdoor speakers. Not covered by the support plan — charged at the plan rate.', callout_fee: 0, labour_hours: 4, labour_rate: 650, invoiced: true, materials: [ { description: 'Episode outdoor speaker 6.5", pair', qty: 1, cost_price: 5400, unit_price: 7290 } ] },
  { job_type: 'once_off',    status: 'in_progress', client: 'waterfall', quote: 'waterfall', title: 'Waterfall — intercom and camera programming', location: '14 Kikuyu Close, Waterfall', staff: 'Kyle Jacobs', days_ago: 1, work_description: 'Program the 2N intercom to the gate motor and phones; set camera analytics zones.', callout_fee: 0, labour_rate: 650, materials: [] },
  { job_type: 'maintenance', status: 'pending',     client: 'sandhurst', coverage: 'covered', title: 'Monthly support visit — October', location: '41 Oxford Road, Sandhurst', staff: 'Kyle Jacobs', days_ahead: 5, work_description: 'Controller updates, 4Sight check, remote batteries.', callout_fee: 0, labour_rate: 650, materials: [] },
]

// Support plans: [client, name, period, fee, visits, callout rate, types, months running]
const CONTRACTS = [
  { client: 'sandhurst', name: 'Gold Support', billing_period: 'monthly', fee: 1450, included_visits: 6, callout_rate: 650,
    covered_job_types: ['maintenance', 'callout', 'repair'], response_time: 'next business day', months: 7 },
  { client: 'houghton', name: 'Hospitality Care', billing_period: 'annual', fee: 24000, included_visits: 4, callout_rate: 750,
    covered_job_types: ['maintenance', 'callout', 'repair', 'emergency'], response_time: '4 hours', months: 3 },
]

// Devices: [room, category, sku, serial, mac, ip, username, password]
const DEVICES = {
  waterfall: [
    ['Rack', 'Network', 'UBQ-UDM-PRO', 'UDMP24A91F3', '24:5A:4C:91:1F:30', '192.168.1.1', 'admin', 'Hav3n!Wf-2026'],
    ['Rack', 'Network', 'UBQ-USW-24P', 'USW24P88C1A', '24:5A:4C:88:C1:A2', '192.168.1.2', null, null],
    ['Rack', 'NVR / recorder', 'HIK-NVR-8', 'DS7608-K2024A118', '44:47:CC:18:0B:9E', '192.168.1.20', 'admin', 'Cam-Wf#8841'],
    ['Driveway', 'Camera', 'HIK-8MP-BUL', 'DS2CD-K2024B332', '44:47:CC:32:11:40', '192.168.1.21', null, null],
    ['Driveway', 'Camera', 'HIK-8MP-BUL', 'DS2CD-K2024B333', '44:47:CC:32:11:41', '192.168.1.22', null, null],
    ['Gate', 'Intercom / access', '2N-IP-VERSO', '54-2140-0098', '7C:1E:B3:40:00:98', '192.168.1.30', 'admin', 'Gate2N!552'],
    ['Lounge', 'Wi-Fi access point', 'UBQ-U6-PRO', 'U6P9A12F007', '24:5A:4C:9A:F0:07', '192.168.1.41', null, null],
    ['Garden', 'Wi-Fi access point', 'UBQ-U6-MESH', 'U6M77B21C4E', '24:5A:4C:77:C4:E1', '192.168.1.44', null, null],
  ],
  houghton: [
    ['Server room', 'Network', 'UBQ-UDM-PRO', 'UDMP24A02B10', '24:5A:4C:02:B1:00', '10.10.0.1', 'admin', 'Rose!Net-7719'],
    ['Lobby', 'Audio', 'SON-AMP', 'RINCON-AMP-7731', '48:A6:B8:77:31:0C', '10.10.0.60', null, null],
    ['Restaurant', 'Audio', 'SON-AMP', 'RINCON-AMP-7732', '48:A6:B8:77:32:0D', '10.10.0.61', null, null],
  ],
}

const SITES = [
  { address: '23 Bompas Road, Dunkeld, Johannesburg',       lat: -26.1398, lng: 28.0391 },
  { address: '14 Kikuyu Close, Waterfall Country Estate',   lat: -26.0197, lng: 28.1087 },
  { address: '6 Houghton Drive, Houghton Estate',           lat: -26.1601, lng: 28.0598 },
  { address: '41 Oxford Road, Sandhurst, Sandton',          lat: -26.1152, lng: 28.0437 },
  { address: '15 Baker Street, Rosebank',                   lat: -26.1449, lng: 28.0422 },
]

// ═════════════════════════════════════════════════════════════════════════════
// RUN
// ═════════════════════════════════════════════════════════════════════════════

const ins = async (table, rows, select = 'id') => {
  if (!rows.length) return []
  const { data, error } = await sb.from(table).insert(rows).select(select)
  if (error) { console.error(`  ✗ ${table}: ${error.message}`); process.exit(1) }
  return data ?? []
}

let wiped = false, completed = false
process.on('exit', () => {
  if (wiped && !completed) {
    try {
      process.stderr.write('\n!!! SEED DID NOT FINISH — the demo account is EMPTY. Re-run: node scripts/seed-installer-demo.mjs\n')
    } catch {}
  }
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1))
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

async function run() {
  console.log(`\nSeeding installer demo account — ${COMPANY}\n`)

  // ── 0. Migration check ─────────────────────────────────────────────────────
  const { error: migErr } = await sb.from('elec_kits').select('id').limit(1)
  const { error: colErr } = await sb.from('supplier_portal_accounts').select('trade_type').limit(1)
  if (migErr || colErr) {
    console.error('  ✗ supabase/installer_phase1.sql has not been run on this database yet. Run it first.')
    process.exit(1)
  }

  // ── 1. Auth user ───────────────────────────────────────────────────────────
  let userId
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = list?.users?.find(u => u.email === EMAIL)
  if (existingUser) {
    userId = existingUser.id
    // Never reset a password that already works — an admin reset logs out
    // anyone mid-demo.
    if (await passwordWorks(EMAIL, PASSWORD)) {
      console.log(`  · auth user reused, password untouched — ${userId}`)
    } else {
      await sb.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
      console.log(`  ! auth user password did not match — reset (this logs out any live session)`)
    }
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
    if (error) { console.error('Auth error:', error.message); process.exit(1) }
    userId = data.user.id
    console.log(`  · auth user created — ${userId}`)
  }

  // ── 2. Portal account ──────────────────────────────────────────────────────
  const { data: acct, error: acctErr } = await sb
    .from('supplier_portal_accounts')
    .upsert({
      auth_user_id:        userId,
      email:               EMAIL,
      company_name:        COMPANY,
      contact_name:        'Noah Pillay',
      phone:               '011 568 2230',
      address:             'Unit 4, The Hub, 18 Wessel Road, Rivonia, Johannesburg, 2128',
      description:         'Home automation, AV, CCTV and networking',
      supplier_category:   'trades',
      plan:                'installer_pro',
      plan_category:       'electrician',
      trade_type:          'installer',
      subscription_status: 'active',
      trial_ends_at:       null,
      setup_fee_paid:      true,
      receive_price_requests: false,
    }, { onConflict: 'auth_user_id' })
    .select('id')
    .single()
  if (acctErr) { console.error('Portal account error:', acctErr.message); process.exit(1) }
  const A = acct.id
  console.log(`  · portal account — ${A}`)

  // ── 3. Wipe previous demo data (this account only) ─────────────────────────
  const { data: oldQuotes } = await sb.from('elec_quotes').select('id').eq('portal_account_id', A)
  const oldQuoteIds = (oldQuotes ?? []).map(q => q.id)
  const { data: oldJCs } = await sb.from('elec_job_cards').select('id').eq('portal_account_id', A)
  const oldJCIds = (oldJCs ?? []).map(j => j.id)

  if (oldJCIds.length) {
    await sb.from('elec_job_card_materials').delete().in('job_card_id', oldJCIds)
    await sb.from('elec_job_card_photos').delete().in('job_card_id', oldJCIds)
  }
  if (oldQuoteIds.length) {
    const { data: oldClaims } = await sb.from('elec_claims').select('id').in('quote_id', oldQuoteIds)
    const oldClaimIds = (oldClaims ?? []).map(c => c.id)
    if (oldClaimIds.length) await sb.from('elec_claim_line_items').delete().in('claim_id', oldClaimIds)
    await sb.from('elec_claims').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_snag_items').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_quote_line_items').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_variation_orders').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_quote_sections').delete().in('quote_id', oldQuoteIds)
  }
  for (const t of ['elec_devices', 'elec_service_contracts', 'elec_material_requests', 'elec_notifications', 'elec_time_punches', 'elec_jobs',
                   'elec_job_cards', 'elec_quotes', 'elec_clients', 'elec_kits',
                   'elec_item_library', 'elec_section_library']) {
    await sb.from(t).delete().eq('portal_account_id', A)
  }
  wiped = true
  console.log('  · previous demo data cleared')

  // ── 4. Settings ────────────────────────────────────────────────────────────
  const { error: setErr } = await sb.from('elec_settings').upsert({
    portal_account_id:              A,
    company_code:                   CODE,
    company_registration_number:    '2019/218844/07',
    vat_registration_number:        '4610295518',
    bank_name:                      'Nedbank',
    bank_account_number:            '1172 548 903',
    bank_branch_code:               '198 765',
    bank_account_type:              'current',
    default_vat_rate:               15,
    default_retention_percentage:   0,
    default_payment_terms_days:     7,
    default_defects_liability_days: 90,
    default_deposit_percentage:     DEPOSIT,
    contract_invoice_prefix:        'SUP',
    contract_invoices_auto_send:    false,
    quote_prefix:                   'QU',
    claim_prefix:                   'INV',
    vo_prefix:                      'VO',
    coc_prefix:                     'COC',
    email_footer_text:              'Haven Smart Homes (Demo) · Control4 Dealer · Ubiquiti & Hikvision installers · Rivonia, Johannesburg',
  }, { onConflict: 'portal_account_id' })
  if (setErr) { console.error(`  ✗ settings: ${setErr.message}`); process.exit(1) }
  console.log('  · settings')

  // ── 5. Staff (+ their mobile auth users) ───────────────────────────────────
  const staffIds = {}
  for (const s of STAFF) {
    const fields = {
      portal_account_id: A,
      name: s.name, role: s.role, phone: s.phone,
      email: null, color: s.color, is_active: true,
      username: s.username, pin_hash: hashStaffPin(s.pin),
    }
    const { data: existingStaff } = await sb.from('elec_staff').select('id, portal_account_id').eq('username', s.username).maybeSingle()
    if (existingStaff && existingStaff.portal_account_id !== A) {
      console.error(`  ✗ username ${s.username} belongs to another account — refusing to touch it`); process.exit(1)
    }
    let row, error
    if (existingStaff) {
      ({ data: row, error } = await sb.from('elec_staff').update(fields).eq('id', existingStaff.id).select('id').single())
    } else {
      ({ data: row, error } = await sb.from('elec_staff').insert(fields).select('id').single())
    }
    if (error) { console.error(`  ✗ staff ${s.name}: ${error.message}`); process.exit(1) }
    staffIds[s.name] = row.id

    const sEmail = staffAuthEmail(s.username)
    const existingStaffUser = list?.users?.find(u => u.email === sEmail)
    let sUid
    if (existingStaffUser) {
      sUid = existingStaffUser.id
    } else {
      const { data: su, error: sErr } = await sb.auth.admin.createUser({
        email: sEmail, password: staffAuthPassword(s.pin), email_confirm: true,
      })
      if (sErr) { console.error(`  ✗ staff auth ${s.username}: ${sErr.message}`); process.exit(1) }
      sUid = su.user.id
    }
    await sb.from('elec_staff').update({ auth_user_id: sUid }).eq('id', row.id)
  }
  console.log(`  · ${STAFF.length} staff (mobile logins active)`)

  // ── 6. Clients ─────────────────────────────────────────────────────────────
  const clientIds = {}
  for (const c of CLIENTS) {
    const { key, ...rest } = c
    const rows = await ins('elec_clients', [{ portal_account_id: A, ...rest }])
    clientIds[key] = rows[0].id
  }
  console.log(`  · ${CLIENTS.length} clients`)

  // ── 7. Catalogue + kits ────────────────────────────────────────────────────
  await ins('elec_item_library', CATALOGUE.map(([sku, brand, description, category, unit, cost, markup, usage]) => ({
    portal_account_id: A, sku, brand, supplier_name: brand ? 'Demo Distribution' : null,
    description: brand ? `${brand} ${description}` : description,
    category, unit,
    item_type: category === 'Labour & Programming' ? 'labour' : 'material',
    default_cost_rate: cost, default_markup_percent: markup,
    default_unit_rate: round2(cost * (1 + markup / 100)), usage_count: usage,
  })))
  for (const k of KITS) {
    const [kit] = await ins('elec_kits', [{ portal_account_id: A, name: k.name, description: k.description }])
    await ins('elec_kit_items', k.items.map(([sku, qty], i) => {
      const line = L(sku, qty)
      return {
        kit_id: kit.id, description: line.description, unit: line.unit, quantity: qty,
        cost_unit_rate: line.cost_unit_rate, markup_percentage: line.markup_percentage,
        quoted_unit_rate: line.quoted_unit_rate, labour_rate: null, sort_order: i,
      }
    }))
  }
  await ins('elec_section_library', ['Rack & Network', 'Lounge', 'Main Bedroom', 'Kitchen & Patio', 'Cinema', 'Driveway & Perimeter', 'Labour & Programming']
    .map((title, i) => ({ portal_account_id: A, title, usage_count: 10 - i })))
  console.log(`  · ${CATALOGUE.length} catalogue items, ${KITS.length} kits`)

  // ── 8. Quotes ──────────────────────────────────────────────────────────────
  let quoteSeq = 0, claimSeq = 0
  const quoteIds = {}
  let totalItems = 0, totalClaims = 0, totalOptional = 0

  for (const q of QUOTES) {
    quoteSeq += 1
    const quote_number = `${CODE}-QU-${YEAR}-${String(quoteSeq).padStart(3, '0')}`
    const [quoteRow] = await ins('elec_quotes', [{
      portal_account_id: A,
      client_id: clientIds[q.client],
      quote_number,
      project_name: q.project_name,
      project_address: q.project_address ?? null,
      project_type: q.project_type,
      contract_type: 'lump_sum',
      status: q.status,
      vat_rate: 15,
      retention_percentage: 0,
      payment_terms_days: 7,
      defects_liability_period_days: 90,
      deposit_percentage: q.deposit ?? DEPOSIT,
      notes: q.notes ?? null,
      quoted_date: q.quoted_date ?? null,
      approved_date: q.approved_date ?? null,
      expected_completion_date: q.expected_completion_date ?? null,
      created_by_name: 'Noah Pillay',
      staff_id: staffIds['Noah Pillay'],
      additional_staff_ids: [],
      is_quick_job: false,
    }])
    const qid = quoteRow.id
    quoteIds[q.key] = qid

    const lineItems = []
    let sortOrder = 0
    for (const [si, section] of q.sections.entries()) {
      const [secRow] = await ins('elec_quote_sections', [{
        quote_id: qid, title: section.title, sort_order: si,
        option_group: section.option_group ?? null, option_chosen: !!section.option_chosen,
      }])
      for (const item of section.items) {
        sortOrder += 1
        if (item.is_optional) totalOptional += 1
        lineItems.push({
          quote_id: qid, section_id: secRow.id, sort_order: sortOrder,
          description: item.description, unit: item.unit, item_type: item.item_type,
          quoted_quantity: item.quoted_quantity, quoted_unit_rate: item.quoted_unit_rate,
          cost_unit_rate: item.cost_unit_rate, markup_percentage: item.markup_percentage,
          is_optional: item.is_optional, optional_selected: item.optional_selected,
          is_variation: false,
        })
      }
    }
    const savedItems = await ins('elec_quote_line_items', lineItems, 'id, quoted_quantity, quoted_unit_rate, is_optional')
    totalItems += savedItems.length

    // Claims, deposit first — the same shape the app raises on acceptance.
    const client = CLIENTS.find(c => c.key === q.client)
    for (const claim of q.claims ?? []) {
      claimSeq += 1
      const claimLines = savedItems.filter(it => !it.is_optional).map(it => ({
        quote_line_item_id: it.id, percentage_claimed: claim.pct,
        amount_claimed: round2(it.quoted_quantity * it.quoted_unit_rate * claim.pct / 100),
      }))
      const totalClaimed = round2(claimLines.reduce((s, l) => s + l.amount_claimed, 0))
      const settled = ['certified', 'invoiced', 'paid'].includes(claim.status)
      const [claimRow] = await ins('elec_claims', [{
        quote_id: qid, portal_account_id: A,
        claim_number: `${CODE}-INV-${YEAR}-${String(claimSeq).padStart(3, '0')}`,
        claim_date: claim.claim_date, period_month: claim.period,
        claim_type: 'invoice', status: claim.status,
        total_claimed: totalClaimed,
        total_certified: settled ? totalClaimed : null,
        total_invoiced: ['invoiced', 'paid'].includes(claim.status) ? totalClaimed : null,
        total_paid: claim.status === 'paid' ? totalClaimed : null,
        sent_to_name: client?.client_name ?? null, sent_to_email: client?.email ?? null,
        sent_at: iso(new Date(claim.claim_date)),
        notes: claim.notes,
      }])
      await ins('elec_claim_line_items', claimLines.map(l => ({
        claim_id: claimRow.id, ...l,
        percentage_certified: settled ? claim.pct : null,
        amount_certified: settled ? l.amount_claimed : null,
      })))
      totalClaims += 1
    }
  }
  console.log(`  · ${QUOTES.length} projects, ${totalItems} line items (${totalOptional} optional extras), ${totalClaims} claims`)

  // ── 8b. Support plans + their invoice history ───────────────────────────────
  const contractIds = {}
  let invSeq = 0, totalInvoices = 0
  for (const c of CONTRACTS) {
    const start = monthStart(-c.months)
    const startDate = new Date(start + 'T12:00:00')
    const renewal = ymd(new Date(startDate.getFullYear() + 1, startDate.getMonth(), 1))
    const stepMonths = c.billing_period === 'annual' ? 12 : 1
    const periods = []
    for (let m = 0; m < c.months; m += stepMonths) periods.push(monthStart(-c.months + m))
    const next = monthStart(-c.months + periods.length * stepMonths)
    const [row] = await ins('elec_service_contracts', [{
      portal_account_id: A, client_id: clientIds[c.client], name: c.name,
      billing_period: c.billing_period, fee: c.fee, included_visits: c.included_visits,
      includes_remote_support: true, callout_rate: c.callout_rate, covered_job_types: c.covered_job_types,
      response_time: c.response_time, start_date: start, renewal_date: renewal, auto_renew: true,
      next_invoice_date: next, status: 'active',
    }])
    contractIds[c.client] = row.id
    await ins('elec_contract_invoices', periods.map((p, i) => {
      invSeq += 1
      const end = new Date(new Date(p + 'T12:00:00').setMonth(new Date(p + 'T12:00:00').getMonth() + stepMonths))
      end.setDate(end.getDate() - 1)
      const latest = i === periods.length - 1
      return {
        contract_id: row.id, portal_account_id: A,
        invoice_number: `${CODE}-SUP-${YEAR}-${String(invSeq).padStart(3, '0')}`,
        invoice_date: p, due_date: ymd(new Date(new Date(p + 'T12:00:00').getTime() + 7 * DAY)),
        period_start: p, period_end: ymd(end), amount: c.fee, vat_rate: 15,
        // everything paid except the latest, which is out with the client
        status: latest ? 'sent' : 'paid',
        sent_at: iso(new Date(p + 'T09:00:00')),
        paid_at: latest ? null : iso(new Date(new Date(p + 'T12:00:00').getTime() + 5 * DAY)),
      }
    }))
    totalInvoices += periods.length
  }
  console.log(`  · ${CONTRACTS.length} support plans, ${totalInvoices} plan invoices`)

  // ── 9. Job cards ───────────────────────────────────────────────────────────
  let jcSeq = 0
  const jcIds = []
  for (const jc of JOB_CARDS) {
    jcSeq += 1
    const when = jc.days_ahead != null ? daysAhead(jc.days_ahead) : daysAgo(jc.days_ago)
    const client = CLIENTS.find(c => c.key === jc.client)
    const [row] = await ins('elec_job_cards', [{
      portal_account_id: A,
      client_id: clientIds[jc.client],
      quote_id: jc.quote ? quoteIds[jc.quote] : null,
      staff_id: staffIds[jc.staff],
      service_contract_id: jc.coverage && contractIds[jc.client] ? contractIds[jc.client] : null,
      contract_coverage: jc.coverage && contractIds[jc.client] ? jc.coverage : null,
      job_number: `JC-${String(jcSeq).padStart(4, '0')}`,
      job_type: jc.job_type,
      status: jc.status,
      title: jc.title,
      location: jc.location,
      scheduled_at: at(when, 9, 0),
      started_at: jc.status === 'pending' ? null : at(when, 9, 10),
      completed_at: jc.status === 'completed' ? at(when, 11, 40) : null,
      work_description: jc.work_description ?? null,
      work_found: jc.work_found ?? null,
      resolution: jc.resolution ?? null,
      client_name: client?.client_name ?? null,
      client_email: client?.email ?? null,
      callout_fee: jc.callout_fee ?? null,
      labour_hours: jc.labour_hours ?? null,
      labour_rate: jc.labour_rate ?? null,
      invoiced: jc.invoiced ?? false,
      created_by_name: 'Aisha Davids',
      additional_staff_ids: [],
      sent_to_name: jc.status === 'completed' ? (client?.client_name ?? null) : null,
      sent_to_email: jc.status === 'completed' ? (client?.email ?? null) : null,
      sent_at: jc.status === 'completed' ? at(when, 12, 5) : null,
    }])
    jcIds.push({ id: row.id, jc })
    if (jc.materials?.length) {
      await ins('elec_job_card_materials', jc.materials.map(m => ({
        job_card_id: row.id, description: m.description, qty: m.qty,
        unit_price: m.unit_price, cost_price: m.cost_price,
      })))
    }
  }
  console.log(`  · ${JOB_CARDS.length} job cards`)

  // ── 9b. Device register ────────────────────────────────────────────────────
  const deviceRows = []
  for (const [site, list] of Object.entries(DEVICES)) {
    const q = QUOTES.find(x => x.key === site)
    const installed = q?.approved_date ?? ymd(daysAgo(30))
    for (const [room, category, sku, serial, mac, ip, username, password] of list) {
      const c = cat.get(sku)
      deviceRows.push({
        portal_account_id: A, client_id: clientIds[site], quote_id: quoteIds[site] ?? null,
        room, category, brand: c.brand, model: c.description, serial_number: serial, mac_address: mac, ip_address: ip,
        installed_on: installed,
        warranty_until: ymd(new Date(new Date(installed + 'T12:00:00').getTime() + (category === 'Camera' ? 3 : 2) * 365 * DAY)),
        username, password_encrypted: password ? encryptSecret(password) : null,
        created_by_name: 'Thandeka Zulu',
      })
    }
  }
  await ins('elec_devices', deviceRows)
  console.log(`  · ${deviceRows.length} devices registered (with encrypted logins)`)

  // ── 10. Scheduled jobs (calendar) ──────────────────────────────────────────
  const schedule = [
    { title: 'Waterfall — final camera aiming and handover', staff: 'Pieter Nel',    quote: 'waterfall', day: 1, start: '08:00', end: '13:00', address: '14 Kikuyu Close, Waterfall' },
    { title: 'Waterfall — intercom programming',            staff: 'Kyle Jacobs',   quote: 'waterfall', day: 1, start: '10:00', end: '14:00', address: '14 Kikuyu Close, Waterfall' },
    { title: 'Dunkeld — pre-wire mark-up',                   staff: 'Noah Pillay',   quote: 'dunkeld',   day: 2, start: '09:00', end: '12:00', address: '23 Bompas Road, Dunkeld' },
    { title: 'Rosebank — boardroom site survey',             staff: 'Thandeka Zulu', quote: 'rosebank',  day: 3, start: '09:00', end: '11:00', address: '15 Baker Street, Rosebank' },
    { title: 'Waterfall — Wi-Fi coverage test',              staff: 'Musa Khumalo',  quote: 'waterfall', day: 4, start: '08:00', end: '12:00', address: '14 Kikuyu Close, Waterfall' },
  ]
  await ins('elec_jobs', schedule.map(s => ({
    portal_account_id: A,
    quote_id: quoteIds[s.quote],
    staff_id: staffIds[s.staff],
    title: s.title,
    address: s.address,
    scheduled_date: ymd(daysAhead(s.day)),
    start_time: s.start,
    end_time: s.end,
    status: 'scheduled',
  })))
  console.log(`  · ${schedule.length} scheduled jobs`)

  // ── 11. Time punches — last 2 working weeks ────────────────────────────────
  const fieldStaff = ['Thandeka Zulu', 'Pieter Nel', 'Musa Khumalo', 'Kyle Jacobs']
  const punches = []
  for (let d = 14; d >= 0; d--) {
    const day = daysAgo(d)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue
    for (const [i, name] of fieldStaff.entries()) {
      const site = SITES[(d + i) % SITES.length]
      const inMin  = 20 + ((d * 7 + i * 11) % 35)
      const outMin = 10 + ((d * 5 + i * 13) % 45)
      const jitter = () => (Math.random() - 0.5) * 0.0018
      punches.push({
        portal_account_id: A, staff_id: staffIds[name], punch_type: 'clock_in',
        punched_at: at(day, 7, inMin), latitude: Number((site.lat + jitter()).toFixed(6)),
        longitude: Number((site.lng + jitter()).toFixed(6)), address: site.address,
      })
      if (!(d === 0 && i < 2)) {
        punches.push({
          portal_account_id: A, staff_id: staffIds[name], punch_type: 'clock_out',
          punched_at: at(day, 16, outMin), latitude: Number((site.lat + jitter()).toFixed(6)),
          longitude: Number((site.lng + jitter()).toFixed(6)), address: site.address,
        })
      }
    }
  }
  // Job-card sessions, so job cards and the Waterfall project show install vs programming time.
  const jobSession = (jcIndex, name, dayOffset, from, to, work_type) => {
    const day = daysAgo(dayOffset)
    const job_id = jcIds[jcIndex].id
    punches.push(
      { portal_account_id: A, staff_id: staffIds[name], job_id, work_type, punch_type: 'clock_in',  punched_at: at(day, from[0], from[1]) },
      { portal_account_id: A, staff_id: staffIds[name], job_id, punch_type: 'clock_out', punched_at: at(day, to[0], to[1]) },
    )
  }
  const waterfallCard = JOB_CARDS.findIndex(j => j.quote === 'waterfall')
  jobSession(waterfallCard, 'Kyle Jacobs', 2, [9, 0], [12, 30], 'programming')
  jobSession(waterfallCard, 'Pieter Nel', 2, [8, 0], [15, 0], 'install')
  jobSession(waterfallCard, 'Kyle Jacobs', 1, [8, 30], [11, 15], 'programming')
  jobSession(0, 'Thandeka Zulu', 2, [9, 10], [10, 40], 'programming')
  await ins('elec_time_punches', punches)
  console.log(`  · ${punches.length} time punches (last 2 weeks, GPS tagged)`)

  // ── 12. Material requests ──────────────────────────────────────────────────
  await ins('elec_material_requests', [
    { portal_account_id: A, source_type: 'project',  quote_id: quoteIds.waterfall, description: 'Hikvision 8MP ColorVu bullet camera', qty: 1, unit: 'nr', status: 'ordered', requested_by_staff_id: staffIds['Pieter Nel'], requested_by_name: 'Pieter Nel', supplier: 'Demo Distribution', ordered_at: iso(daysAgo(2)), notes: 'Replacement for the unit damaged in transit.' },
    { portal_account_id: A, source_type: 'project',  quote_id: quoteIds.waterfall, description: 'Cat6 outdoor UV-rated cable, 305m', qty: 1, unit: 'box', status: 'received', requested_by_staff_id: staffIds['Musa Khumalo'], requested_by_name: 'Musa Khumalo', supplier: 'Demo Distribution', ordered_at: iso(daysAgo(9)), received_at: iso(daysAgo(6)) },
    { portal_account_id: A, source_type: 'job_card', job_card_id: jcIds[3].id, description: 'Sonos Era 100 speaker', qty: 1, unit: 'nr', status: 'pending', requested_by_staff_id: staffIds['Thandeka Zulu'], requested_by_name: 'Thandeka Zulu', notes: 'Loan unit for the client while we sort the bedroom amp.' },
  ])
  console.log('  · 3 material requests')

  // ── 13. Notifications ──────────────────────────────────────────────────────
  await ins('elec_notifications', [
    { portal_account_id: A, type: 'clock_in',         title: 'Thandeka Zulu clocked in',           body: 'Clocked in · 41 Oxford Road, Sandhurst',        created_at: at(daysAgo(0), 7, 41), metadata: {} },
    { portal_account_id: A, type: 'job_card_created', title: 'New job card JC-0004',               body: '"Sonos dropping out in the main bedroom"',      created_at: at(daysAgo(0), 8, 55), metadata: {} },
    { portal_account_id: A, type: 'material_request', title: 'Material request from Thandeka Zulu', body: 'Sonos Era 100 speaker × 1',                      created_at: at(daysAgo(0), 10, 12), metadata: {} },
    { portal_account_id: A, type: 'invoice',          title: `Claim ${CODE}-INV-${YEAR}-002 submitted`, body: 'Waterfall Estate — CCTV, Intercom & Wi-Fi', created_at: at(daysAgo(3), 15, 30), metadata: {}, read_at: iso(daysAgo(2)) },
  ])
  console.log('  · 4 notifications')

  // ── verify ─────────────────────────────────────────────────────────────────
  // Staff are counted separately below: logins someone added by hand to the
  // demo (a person trying the staff app) are kept, and aren't a failure.
  const expected = {
    elec_clients: CLIENTS.length, elec_quotes: QUOTES.length, elec_job_cards: JOB_CARDS.length,
    elec_jobs: schedule.length, elec_kits: KITS.length,
    elec_item_library: CATALOGUE.length, elec_service_contracts: CONTRACTS.length,
    elec_devices: Object.values(DEVICES).reduce((s, l) => s + l.length, 0),
  }
  const wrong = []
  for (const [table, want] of Object.entries(expected)) {
    const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).eq('portal_account_id', A)
    if (count !== want) wrong.push(`${table}: expected ${want}, found ${count}`)
  }
  const { count: seededStaff } = await sb.from('elec_staff').select('*', { count: 'exact', head: true })
    .eq('portal_account_id', A).in('username', STAFF.map(x => x.username))
  if (seededStaff !== STAFF.length) wrong.push(`elec_staff: expected ${STAFF.length} demo staff, found ${seededStaff}`)
  if (wrong.length) { console.error('\n  ✗ VERIFY FAILED\n    ' + wrong.join('\n    ')); process.exit(1) }
  completed = true

  console.log(`
─────────────────────────────────────────────────────────────
  DEMO ACCOUNT READY — ${COMPANY}
─────────────────────────────────────────────────────────────
  Portal   https://quotinghub.co.za/supplier-portal/login
  Email    ${EMAIL}
  Password ${PASSWORD}

  Staff mobile app  /supplier-portal/login  →  "Staff sign in"
${STAFF.map(s => `    ${s.username.padEnd(12)} PIN ${s.pin}   ${s.name} (${s.role})`).join('\n')}
─────────────────────────────────────────────────────────────
`)
}

run().catch(e => { console.error(e); process.exit(1) })
