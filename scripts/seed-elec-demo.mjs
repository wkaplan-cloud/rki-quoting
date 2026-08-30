#!/usr/bin/env node
/**
 * Seeds a fully-populated demo ELECTRICIAN portal account for sales demos.
 *
 * Usage:
 *   node scripts/seed-elec-demo.mjs
 *
 * Safe to re-run — it wipes and rebuilds this demo account's data only.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
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

// ─── demo identity ────────────────────────────────────────────────────────────
const EMAIL    = 'demo-elec@quotinghub.co.za'
const PASSWORD = 'ElecDemo2026!'
const COMPANY  = 'Nexus Electrical (Demo)'
const CODE     = 'NEX'
const YEAR     = new Date().getFullYear()

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
  { name: 'Dean Marais',    role: 'admin',        phone: '082 441 7712', color: '#3A7CA5', username: 'nexdean',   pin: '1101' },
  { name: 'Sipho Ndlovu',   role: 'site_foreman', phone: '083 226 4419', color: '#D9A441', username: 'nexsipho',  pin: '1102' },
  { name: 'Johan van Wyk',  role: 'electrician',  phone: '072 815 3390', color: '#5B8C5A', username: 'nexjohan',  pin: '1103' },
  { name: 'Thabo Mokoena',  role: 'electrician',  phone: '076 302 8871', color: '#A35C5C', username: 'nexthabo',  pin: '1104' },
  { name: 'Riaan Botha',    role: 'apprentice',   phone: '081 664 2205', color: '#7B6CA8', username: 'nexriaan',  pin: '1105' },
  { name: 'Lerato Dlamini', role: 'admin',        phone: '084 119 7743', color: '#C97B4A', username: 'nexlerato', pin: '1106' },
]

const CLIENTS = [
  { key: 'belmont',  client_name: 'Belmont Retail Developments', company: 'Belmont Retail Developments (Pty) Ltd', email: 'accounts@belmontretail.co.za',  contact_number: '011 326 4400', vat_number: '4290187733', address: 'Belmont Retail Centre, cnr Rivonia & Kelvin Rd, Sandton, 2196', payment_terms_days: 30, qs_name: 'Melanie Roux',   qs_email: 'melanie@rouxqs.co.za', notes: 'Retention 10%. Claims must reach the QS by the 25th of each month.' },
  { key: 'grayston', client_name: 'Grayston Office Park',        company: 'Grayston Park Management (Pty) Ltd',     email: 'facilities@graystonpark.co.za', contact_number: '011 884 2210', vat_number: '4130229914', address: '128 Grayston Drive, Sandown, Johannesburg, 2196', payment_terms_days: 30, qs_name: null, qs_email: null, notes: 'Access via facilities office. Induction required for all staff.' },
  { key: 'kruger',   client_name: 'Kruger Property Group',       company: 'Kruger Property Group (Pty) Ltd',        email: 'anton@krugerproperty.co.za',    contact_number: '011 493 7781', vat_number: '4560331128', address: '9 Steel Road, Wadeville, Germiston, 1428', payment_terms_days: 45, qs_name: null, qs_email: null, notes: 'Anton Kruger signs off all variation orders personally.' },
  { key: 'sandton',  client_name: 'Sandton Ridge Body Corporate',company: null,                                     email: 'trustees@sandtonridge.co.za',   contact_number: '011 783 0091', vat_number: null,         address: '44 Rivonia Road, Sandton, 2196', payment_terms_days: 30, qs_name: null, qs_email: null, notes: 'Managing agent: Trafalgar. PO required before starting any work.' },
  { key: 'wbho',     client_name: 'WBHO Construction',           company: 'WBHO Construction (Pty) Ltd',            email: 'subcontracts@wbho.co.za',       contact_number: '011 321 7200', vat_number: '4020104456', address: '53 Andries Street, Wynberg, Sandton, 2090', payment_terms_days: 45, qs_name: 'Pieter Cronje', qs_email: 'pcronje@wbho.co.za', notes: 'Main contractor. Payment 45 days from statement. Strict site H&S file.' },
  { key: 'fourie',   client_name: 'Anelle Fourie',               company: null,                                     email: 'anelle.fourie@gmail.com',       contact_number: '082 774 1136', vat_number: null,         address: '17 Bompas Road, Dunkeld West, Johannesburg, 2196', payment_terms_days: 14, qs_name: null, qs_email: null, notes: 'Private residence. Architect: Studio Vermeulen.' },
  { key: 'riverside',client_name: 'Riverside Lodge Hotel',       company: 'Riverside Hospitality (Pty) Ltd',        email: 'maintenance@riversidelodge.co.za', contact_number: '011 705 3312', vat_number: '4770118823', address: 'R114 Cedar Road, Broadacres, Fourways, 2055', payment_terms_days: 30, qs_name: null, qs_email: null, notes: 'Standing maintenance agreement — monthly callouts billed on job cards.' },
]

// item helper: cost + markup → sell rate
const li = (description, unit, qty, cost, markup, item_type = 'both') => ({
  description, unit, quoted_quantity: qty, cost_unit_rate: cost, markup_percentage: markup,
  quoted_unit_rate: round2(cost * (1 + markup / 100)), item_type,
})

const QUOTES = [
  {
    key: 'belmont',
    client: 'belmont',
    project_name: 'Belmont Retail Centre — Electrical Installation',
    project_address: 'Belmont Retail Centre, cnr Rivonia & Kelvin Rd, Sandton',
    description: 'Complete electrical reticulation to 6 retail units, common areas and parking deck, including main distribution, lighting, small power and earthing.',
    project_type: 'commercial',
    contract_type: 'lump_sum',
    status: 'in_progress',
    retention_percentage: 10,
    payment_terms_days: 30,
    drawing_reference: 'E-101 Rev 3',
    quoted_date: ymd(daysAgo(118)),
    approved_date: ymd(daysAgo(104)),
    expected_completion_date: ymd(daysAhead(46)),
    sections: [
      { title: 'Preliminaries & Generals', items: [
        li('Site establishment, temporary power and site office electrical', 'lot', 1, 38000, 25, 'preliminary'),
        li('Health & safety file, method statements and risk assessments', 'lot', 1, 12000, 25, 'preliminary'),
        li('As-built drawings and O&M manuals on completion', 'lot', 1, 9500, 25, 'preliminary'),
      ]},
      { title: 'Main Distribution', items: [
        li('Supply and install 400A three-phase main distribution board, Form 2b', 'nr', 1, 96000, 30),
        li('Supply and install 125A sub-distribution board to retail unit', 'nr', 6, 18400, 30),
        li('Supply and install 4-core 185mm² PVC/SWA/PVC sub-main cable', 'm', 180, 640, 25, 'material'),
        li('Terminate and gland 185mm² armoured cable', 'nr', 8, 890, 30, 'labour'),
        li('Supply and install 100mm galvanised cable tray including supports', 'm', 240, 310, 30),
      ]},
      { title: 'Lighting Installation', items: [
        li('Supply and install 1200mm LED batten fitting 40W IP20', 'nr', 145, 385, 35),
        li('Supply and install 12W dimmable LED downlight', 'nr', 96, 210, 35),
        li('Supply and install emergency luminaire c/w 3-hour battery backup', 'nr', 38, 640, 35),
        li('Lighting circuit wiring in 2.5mm² surfix, clipped direct', 'm', 1450, 42, 40),
        li('Supply and install 2-lever light switch, white', 'nr', 54, 78, 40),
      ]},
      { title: 'Power & Small Power', items: [
        li('Supply and install 16A double switched socket outlet', 'nr', 128, 145, 40),
        li('Supply and install 16A dedicated socket outlet on isolator', 'nr', 22, 240, 40),
        li('Supply and install 32A three-phase socket outlet to kitchen', 'nr', 6, 1150, 30),
        li('Power circuit wiring in 4mm² surfix, clipped direct', 'm', 980, 68, 40),
      ]},
      { title: 'Earthing & Bonding', items: [
        li('Supply and install main earth electrode and inspection pit', 'nr', 2, 3400, 30),
        li('Equipotential bonding of structural steel and pipework', 'lot', 1, 18500, 30),
        li('Earth continuity testing, certification and COC issue', 'lot', 1, 14000, 30, 'labour'),
      ]},
    ],
    vos: [
      { description: 'Additional 12 x LED downlights and 3 x dedicated outlets to Shop 4 per client instruction CI-07', value: 86400, cost_value: 61700, status: 'approved', requested_by: 'Melanie Roux', approved_by: 'Melanie Roux', approved_date: ymd(daysAgo(38)) },
      { description: 'Relocation of Shop 6 distribution board and 18m extension to sub-main', value: 42750, cost_value: 31200, status: 'pending', requested_by: 'Site Agent — Belmont' },
    ],
    claims: [
      { pct: 30, period: monthStart(-2), claim_date: ymd(daysAgo(72)), status: 'paid',      notes: 'First progress claim — first fix complete to Shops 1–3.' },
      { pct: 25, period: monthStart(-1), claim_date: ymd(daysAgo(41)), status: 'invoiced',  notes: 'Second progress claim — main DB energised, lighting first fix complete.' },
      { pct: 20, period: monthStart(0),  claim_date: ymd(daysAgo(9)),  status: 'submitted', notes: 'Third progress claim — second fix in progress to Shops 4–6.' },
    ],
    snags: [
      { description: 'Emergency luminaire above Shop 3 fire exit not switching to battery on mains failure', status: 'open', raised_by: 'Melanie Roux', raised_date: ymd(daysAgo(6)) },
      { description: 'Two socket outlets in Shop 2 storeroom not level with adjacent data points', status: 'in_progress', raised_by: 'Site Agent — Belmont', raised_date: ymd(daysAgo(12)) },
      { description: 'Cable tray in parking deck missing earth continuity strap at expansion joint', status: 'resolved', raised_by: 'Sipho Ndlovu', raised_date: ymd(daysAgo(24)), resolved_date: ymd(daysAgo(18)) },
    ],
  },
  {
    key: 'grayston',
    client: 'grayston',
    project_name: 'Grayston Office Park — Block C Refurbishment',
    project_address: '128 Grayston Drive, Sandown, Johannesburg',
    description: 'Strip-out and re-installation of lighting, small power and DB upgrade to Block C open-plan floors 2 and 3.',
    project_type: 'commercial',
    contract_type: 'lump_sum',
    status: 'in_progress',
    retention_percentage: 5,
    payment_terms_days: 30,
    drawing_reference: 'GOP-C-E-04',
    quoted_date: ymd(daysAgo(76)),
    approved_date: ymd(daysAgo(65)),
    expected_completion_date: ymd(daysAhead(21)),
    sections: [
      { title: 'Strip-out & Making Good', items: [
        li('Safe isolation, strip-out of redundant lighting and small power', 'lot', 1, 46000, 25, 'labour'),
        li('Removal and lawful disposal of redundant fluorescent fittings', 'nr', 210, 46, 30),
      ]},
      { title: 'Distribution', items: [
        li('Supply and install 250A floor distribution board c/w surge protection', 'nr', 2, 42000, 30),
        li('Supply and install 4-core 70mm² PVC/SWA/PVC sub-main cable', 'm', 95, 385, 25, 'material'),
      ]},
      { title: 'Lighting & Power', items: [
        li('Supply and install 600x600 LED panel 36W, recessed', 'nr', 128, 465, 35),
        li('Supply and install occupancy sensor c/w daylight harvesting', 'nr', 24, 890, 35),
        li('Supply and install floor box c/w 4 x 16A outlets and data provision', 'nr', 36, 1450, 30),
        li('Lighting and power wiring in 2.5mm² and 4mm² surfix', 'm', 1180, 54, 40),
      ]},
    ],
    vos: [
      { description: 'Additional 6 x floor boxes to Floor 3 following revised furniture layout', value: 34800, cost_value: 26100, status: 'approved', requested_by: 'Facilities Manager', approved_by: 'Facilities Manager', approved_date: ymd(daysAgo(22)) },
    ],
    claims: [
      { pct: 40, period: monthStart(-1), claim_date: ymd(daysAgo(44)), status: 'paid',      notes: 'Strip-out complete, DBs installed and energised.' },
      { pct: 30, period: monthStart(0),  claim_date: ymd(daysAgo(11)), status: 'certified', notes: 'Lighting installation complete to Floor 2.' },
    ],
    snags: [],
  },
  {
    key: 'kruger',
    client: 'kruger',
    project_name: 'Warehouse 4 — High-Bay Lighting Upgrade',
    project_address: '9 Steel Road, Wadeville, Germiston',
    description: 'Replacement of 400W metal halide high-bays with LED high-bays, new lighting control and emergency lighting compliance.',
    project_type: 'industrial',
    contract_type: 'lump_sum',
    status: 'completed',
    retention_percentage: 0,
    payment_terms_days: 45,
    drawing_reference: 'KPG-W4-E-02',
    quoted_date: ymd(daysAgo(196)),
    approved_date: ymd(daysAgo(188)),
    expected_completion_date: ymd(daysAgo(96)),
    practical_completion_date: ymd(daysAgo(92)),
    sections: [
      { title: 'High-Bay Replacement', items: [
        li('Supply and install 150W LED high-bay c/w mounting bracket', 'nr', 64, 1980, 30),
        li('Removal and disposal of existing 400W metal halide fittings', 'nr', 64, 180, 35, 'labour'),
        li('Scissor lift hire and operator, including transport', 'week', 3, 8400, 20, 'subcontract'),
      ]},
      { title: 'Control & Emergency', items: [
        li('Supply and install lighting control panel c/w timeclock and contactors', 'nr', 1, 34000, 30),
        li('Supply and install emergency luminaire c/w 3-hour battery backup', 'nr', 18, 640, 35),
        li('Circuit alterations, testing and certification', 'lot', 1, 22000, 30, 'labour'),
      ]},
    ],
    vos: [
      { description: 'Additional 8 x high-bays to despatch canopy following site instruction', value: 24400, cost_value: 18100, status: 'approved', requested_by: 'Anton Kruger', approved_by: 'Anton Kruger', approved_date: ymd(daysAgo(140)) },
    ],
    claims: [
      { pct: 50, period: monthStart(-4), claim_date: ymd(daysAgo(160)), status: 'paid', notes: 'Fittings delivered to site, 32 of 64 installed.' },
      { pct: 50, period: monthStart(-3), claim_date: ymd(daysAgo(120)), status: 'paid', notes: 'Final claim — installation and commissioning complete.' },
    ],
    snags: [],
    coc: {
      coc_number: '821 604',
      installation_description: 'LED high-bay lighting installation and lighting control panel, Warehouse 4',
      issue_date: ymd(daysAgo(92)),
      installation_type: 'commercial',
      work_type: 'addition',
      supply_phases: 'three',
      main_breaker_amps: '250',
    },
  },
  {
    key: 'sandton',
    client: 'sandton',
    project_name: 'Sandton Ridge — Common Area Rewire',
    project_address: '44 Rivonia Road, Sandton',
    description: 'Rewire of common area lighting, stairwell emergency lighting and basement DB replacement across 3 blocks.',
    project_type: 'residential',
    contract_type: 'lump_sum',
    status: 'approved',
    retention_percentage: 5,
    payment_terms_days: 30,
    quoted_date: ymd(daysAgo(34)),
    approved_date: ymd(daysAgo(12)),
    expected_completion_date: ymd(daysAhead(74)),
    sections: [
      { title: 'Distribution', items: [
        li('Supply and install 100A basement distribution board c/w earth leakage', 'nr', 3, 16800, 30),
        li('Supply and install 4-core 35mm² PVC/SWA/PVC sub-main cable', 'm', 140, 210, 25, 'material'),
      ]},
      { title: 'Common Area Lighting', items: [
        li('Supply and install LED bulkhead fitting 18W IP65', 'nr', 86, 295, 35),
        li('Supply and install stairwell emergency luminaire, 3-hour', 'nr', 24, 640, 35),
        li('Supply and install photocell and timeclock control', 'nr', 3, 2400, 30),
        li('Lighting circuit wiring in 2.5mm² surfix in conduit', 'm', 720, 62, 40),
      ]},
    ],
    vos: [],
    claims: [],
    snags: [],
  },
  {
    key: 'fourie',
    client: 'fourie',
    project_name: 'House Fourie — New Build Electrical Installation',
    project_address: '17 Bompas Road, Dunkeld West, Johannesburg',
    description: 'Complete electrical installation to new 4-bedroom double-storey residence, including inverter provision and COC.',
    project_type: 'residential',
    contract_type: 'lump_sum',
    status: 'quoted',
    retention_percentage: 0,
    payment_terms_days: 14,
    quoted_date: ymd(daysAgo(8)),
    expected_completion_date: ymd(daysAhead(120)),
    sections: [
      { title: 'First Fix', items: [
        li('Supply and install 80A distribution board c/w earth leakage and SPD', 'nr', 1, 14500, 30),
        li('Chase walls and install 20mm conduit and draw boxes', 'm', 480, 78, 40, 'labour'),
        li('Lighting and power wiring in 1.5mm² / 2.5mm² surfix', 'm', 860, 46, 40),
      ]},
      { title: 'Second Fix', items: [
        li('Supply and install 16A double switched socket outlet', 'nr', 54, 145, 40),
        li('Supply and install 12W dimmable LED downlight', 'nr', 62, 210, 35),
        li('Supply and install 2-lever light switch, white', 'nr', 28, 78, 40),
        li('Supply and install stove isolator and 6mm² dedicated circuit', 'nr', 1, 2100, 30),
      ]},
      { title: 'Inverter Provision & Compliance', items: [
        li('Supply and install essential-loads changeover board and wiring provision', 'lot', 1, 18500, 30),
        li('Testing, commissioning and issue of Certificate of Compliance', 'lot', 1, 6500, 30, 'labour'),
      ]},
    ],
    vos: [],
    claims: [],
    snags: [],
  },
  {
    key: 'wbho',
    client: 'wbho',
    project_name: 'Waterfall Node Phase 2 — Electrical Sub-contract',
    project_address: 'Waterfall City, Midrand',
    description: 'Electrical sub-contract to WBHO for Phase 2 podium and parking levels. Re-measurable rates per bill of quantities.',
    project_type: 'commercial',
    contract_type: 're_measurement',
    status: 'quoted',
    retention_percentage: 10,
    payment_terms_days: 45,
    drawing_reference: 'WBHO-WF2-E-11 Rev 1',
    quoted_date: ymd(daysAgo(19)),
    expected_completion_date: ymd(daysAhead(210)),
    sections: [
      { title: 'Bill 1 — Containment', items: [
        li('Supply and install 300mm galvanised cable ladder incl. supports', 'm', 620, 480, 30),
        li('Supply and install 100mm galvanised cable tray incl. supports', 'm', 880, 310, 30),
      ]},
      { title: 'Bill 2 — Cabling', items: [
        li('Supply and install 4-core 120mm² PVC/SWA/PVC cable', 'm', 340, 512, 25, 'material'),
        li('Supply and install 4-core 35mm² PVC/SWA/PVC cable', 'm', 760, 210, 25, 'material'),
        li('Terminate and gland armoured cable up to 120mm²', 'nr', 46, 720, 30, 'labour'),
      ]},
      { title: 'Bill 3 — Parking Level Lighting', items: [
        li('Supply and install LED batten fitting 40W IP65 to parking bays', 'nr', 260, 420, 35),
        li('Supply and install emergency luminaire c/w 3-hour battery backup', 'nr', 72, 640, 35),
        li('Lighting circuit wiring in 2.5mm² surfix on tray', 'm', 2400, 42, 40),
      ]},
    ],
    vos: [],
    claims: [],
    snags: [],
  },
  {
    key: 'riverside',
    client: 'riverside',
    project_name: 'Riverside Lodge — Generator Changeover Panel',
    project_address: 'R114 Cedar Road, Broadacres, Fourways',
    description: 'Supply and install automatic changeover panel and essential-loads reticulation for new 150kVA standby generator.',
    project_type: 'commercial',
    contract_type: 'lump_sum',
    status: 'draft',
    retention_percentage: 0,
    payment_terms_days: 30,
    sections: [
      { title: 'Changeover & Reticulation', items: [
        li('Supply and install 250A automatic transfer switch panel', 'nr', 1, 78000, 30),
        li('Supply and install 4-core 95mm² PVC/SWA/PVC cable to generator', 'm', 62, 445, 25, 'material'),
        li('Terminate and gland 95mm² armoured cable', 'nr', 4, 780, 30, 'labour'),
        li('Essential-loads segregation and re-circuiting of kitchen and reception DB', 'lot', 1, 34000, 30),
        li('Commissioning, load testing and certification', 'lot', 1, 12500, 30, 'labour'),
      ]},
    ],
    vos: [],
    claims: [],
    snags: [],
  },
]

const JOB_CARDS = [
  { job_type: 'callout',     status: 'completed',   client: 'riverside', title: 'No power to conference room ring circuit', location: 'Riverside Lodge Hotel, Broadacres', staff: 'Johan van Wyk',  days_ago: 3,  work_description: 'Guest reported total loss of power to conference room outlets.', work_found: 'Earth leakage tripping on kitchenette circuit — faulty urn flex.', resolution: 'Isolated faulty appliance circuit, replaced damaged 16A outlet and tested. Circuit restored and earth leakage tested at 24ms.', callout_fee: 850, labour_hours: 2.5, labour_rate: 620, invoiced: true, signed: true, materials: [ { description: '16A double switched socket outlet', qty: 1, cost_price: 145, unit_price: 205 }, { description: '2.5mm² surfix cable', qty: 6, cost_price: 42, unit_price: 62 } ] },
  { job_type: 'maintenance', status: 'completed',   client: 'grayston',  title: 'Monthly emergency lighting test — Block C', location: 'Grayston Office Park, Block C', staff: 'Thabo Mokoena', days_ago: 6,  work_description: 'Scheduled monthly 30-minute discharge test of emergency luminaires.', work_found: '3 x luminaires failed to hold charge for full duration.', resolution: 'Replaced 3 x emergency battery packs and re-tested. All 42 fittings now compliant. Test register updated.', callout_fee: 0, labour_hours: 4, labour_rate: 620, invoiced: true, signed: true, materials: [ { description: 'Emergency luminaire battery pack 3hr', qty: 3, cost_price: 285, unit_price: 415 } ] },
  { job_type: 'repair',      status: 'completed',   client: 'sandton',   title: 'Basement 2 lighting circuit failure', location: 'Sandton Ridge, Block B basement', staff: 'Sipho Ndlovu',  days_ago: 9,  work_description: 'Half of basement 2 lighting out since power interruption.', work_found: 'Water ingress into junction box at ramp, corroded terminals.', resolution: 'Replaced junction box with IP65 enclosure, re-terminated 4 circuits, sealed conduit entry. Insulation resistance tested at 42MΩ.', callout_fee: 850, labour_hours: 5.5, labour_rate: 620, invoiced: true, signed: true, materials: [ { description: 'IP65 junction box 150x150', qty: 1, cost_price: 240, unit_price: 340 }, { description: 'LED bulkhead 18W IP65', qty: 2, cost_price: 295, unit_price: 420 } ] },
  { job_type: 'coc',         status: 'completed',   client: 'fourie',    title: 'COC inspection — 17 Bompas Road', location: '17 Bompas Road, Dunkeld West', staff: 'Dean Marais',   days_ago: 14, work_description: 'Pre-sale Certificate of Compliance inspection requested by transferring attorney.', work_found: 'Missing earth leakage on pool circuit, two open junction boxes in roof space.', resolution: 'Installed earth leakage unit, closed and labelled junction boxes, full test and COC issued.', callout_fee: 1450, labour_hours: 6, labour_rate: 620, invoiced: true, signed: true, materials: [ { description: '63A earth leakage unit', qty: 1, cost_price: 680, unit_price: 950 } ] },
  { job_type: 'callout',     status: 'completed',   client: 'kruger',    title: 'Warehouse 4 high-bay flickering', location: '9 Steel Road, Wadeville', staff: 'Johan van Wyk',  days_ago: 18, work_description: 'Two high-bays flickering in aisle 3 since last week.', work_found: 'Loose neutral at lighting control panel contactor.', resolution: 'Re-terminated neutral bar, torque-checked all terminals in control panel, thermal scan clear.', callout_fee: 850, labour_hours: 2, labour_rate: 620, invoiced: true, signed: true, materials: [] },
  { job_type: 'once_off',    status: 'completed',   client: 'riverside', title: 'Install 3 x outdoor floodlights to parking', location: 'Riverside Lodge Hotel, guest parking', staff: 'Thabo Mokoena', days_ago: 22, work_description: 'Client requested additional lighting to guest parking area.', work_found: 'Existing spare way available on garden DB.', resolution: 'Installed 3 x 100W LED floodlights on 3m poles, new circuit from garden DB with photocell control. Tested and handed over.', callout_fee: 0, labour_hours: 9, labour_rate: 620, invoiced: false, signed: true, materials: [ { description: '100W LED floodlight IP66', qty: 3, cost_price: 640, unit_price: 890 }, { description: 'Photocell switch', qty: 1, cost_price: 210, unit_price: 310 }, { description: '2.5mm² 3-core SWA cable', qty: 45, cost_price: 62, unit_price: 92 } ] },
  { job_type: 'maintenance', status: 'in_progress', client: 'grayston',  title: 'Quarterly DB thermal inspection — all floors', location: 'Grayston Office Park, Blocks A–C', staff: 'Sipho Ndlovu',  days_ago: 1,  work_description: 'Quarterly thermographic survey of all distribution boards per maintenance agreement.', work_found: 'Blocks A and B complete. Two hot joints identified on Block A floor 2 DB.', resolution: null, callout_fee: 0, labour_hours: null, labour_rate: 620, invoiced: false, signed: false, materials: [] },
  { job_type: 'repair',      status: 'in_progress', client: 'sandton',   title: 'Block C intercom power supply failure', location: 'Sandton Ridge, Block C entrance', staff: 'Riaan Botha',   days_ago: 0,  work_description: 'Intercom system dead at Block C gate.', work_found: 'Failed 12V power supply unit in gate kiosk, supply cable damaged by rodents.', resolution: null, callout_fee: 850, labour_hours: null, labour_rate: 620, invoiced: false, signed: false, materials: [ { description: '12V 5A power supply unit', qty: 1, cost_price: 420, unit_price: 590 } ] },
  { job_type: 'callout',     status: 'in_progress', client: 'belmont',   title: 'Shop 4 tripping on kitchen equipment', location: 'Belmont Retail Centre, Shop 4', staff: 'Johan van Wyk',  days_ago: 0,  work_description: 'Tenant reports DB tripping when combi oven and fryer run together.', work_found: 'Circuit loading measured at 34A on a 32A way — under investigation.', resolution: null, callout_fee: 850, labour_hours: null, labour_rate: 620, invoiced: false, signed: false, materials: [] },
  { job_type: 'maintenance', status: 'pending',     client: 'riverside', title: 'Monthly maintenance visit — September', location: 'Riverside Lodge Hotel, Broadacres', staff: 'Thabo Mokoena', days_ahead: 4, work_description: 'Scheduled monthly maintenance: emergency lighting test, DB inspection, guest room fault list.', callout_fee: 0, labour_rate: 620, materials: [] },
  { job_type: 'coc',         status: 'pending',     client: 'kruger',    title: 'COC inspection — Warehouse 2 offices', location: '9 Steel Road, Wadeville', staff: 'Dean Marais',   days_ahead: 6, work_description: 'COC required for insurance renewal on Warehouse 2 office block.', callout_fee: 1450, labour_rate: 620, materials: [] },
  { job_type: 'callout',     status: 'pending',     client: 'sandton',   title: 'Unit 12 stove circuit not working', location: 'Sandton Ridge, Unit 12', staff: 'Riaan Botha',   days_ahead: 1, work_description: 'Owner reports no power to stove after earth leakage tripped.', callout_fee: 850, labour_rate: 620, materials: [] },
]

const ITEM_LIBRARY = [
  ['Supply and install 16A double switched socket outlet', 'nr', 'both', 203, 145, 40, 34],
  ['Supply and install 12W dimmable LED downlight', 'nr', 'both', 283.5, 210, 35, 29],
  ['Supply and install 1200mm LED batten fitting 40W IP20', 'nr', 'both', 519.75, 385, 35, 22],
  ['Supply and install emergency luminaire c/w 3-hour battery backup', 'nr', 'both', 864, 640, 35, 19],
  ['Lighting circuit wiring in 2.5mm² surfix, clipped direct', 'm', 'both', 58.8, 42, 40, 27],
  ['Power circuit wiring in 4mm² surfix, clipped direct', 'm', 'both', 95.2, 68, 40, 18],
  ['Supply and install 2-lever light switch, white', 'nr', 'both', 109.2, 78, 40, 24],
  ['Supply and install 100mm galvanised cable tray including supports', 'm', 'both', 403, 310, 30, 12],
  ['Supply and install 4-core 35mm² PVC/SWA/PVC cable', 'm', 'material', 262.5, 210, 25, 14],
  ['Supply and install 4-core 70mm² PVC/SWA/PVC cable', 'm', 'material', 481.25, 385, 25, 9],
  ['Supply and install 4-core 185mm² PVC/SWA/PVC sub-main cable', 'm', 'material', 800, 640, 25, 6],
  ['Terminate and gland armoured cable up to 120mm²', 'nr', 'labour', 936, 720, 30, 11],
  ['Supply and install 80A distribution board c/w earth leakage and SPD', 'nr', 'both', 18850, 14500, 30, 8],
  ['Supply and install 125A sub-distribution board to retail unit', 'nr', 'both', 23920, 18400, 30, 5],
  ['Supply and install 600x600 LED panel 36W, recessed', 'nr', 'both', 627.75, 465, 35, 16],
  ['Supply and install LED bulkhead fitting 18W IP65', 'nr', 'both', 398.25, 295, 35, 13],
  ['Supply and install 150W LED high-bay c/w mounting bracket', 'nr', 'both', 2574, 1980, 30, 7],
  ['Supply and install occupancy sensor c/w daylight harvesting', 'nr', 'both', 1201.5, 890, 35, 6],
  ['Supply and install floor box c/w 4 x 16A outlets and data provision', 'nr', 'both', 1885, 1450, 30, 9],
  ['Supply and install 32A three-phase socket outlet to kitchen', 'nr', 'both', 1495, 1150, 30, 4],
  ['Supply and install main earth electrode and inspection pit', 'nr', 'both', 4420, 3400, 30, 5],
  ['Equipotential bonding of structural steel and pipework', 'lot', 'both', 24050, 18500, 30, 4],
  ['Earth continuity testing, certification and COC issue', 'lot', 'labour', 18200, 14000, 30, 10],
  ['Chase walls and install 20mm conduit and draw boxes', 'm', 'labour', 109.2, 78, 40, 15],
  ['Site establishment, temporary power and site office electrical', 'lot', 'preliminary', 47500, 38000, 25, 6],
  ['Health & safety file, method statements and risk assessments', 'lot', 'preliminary', 15000, 12000, 25, 7],
  ['As-built drawings and O&M manuals on completion', 'lot', 'preliminary', 11875, 9500, 25, 6],
  ['Scissor lift hire and operator, including transport', 'week', 'subcontract', 10080, 8400, 20, 3],
  ['Supply and install 250A automatic transfer switch panel', 'nr', 'both', 101400, 78000, 30, 2],
  ['Supply and install photocell and timeclock control', 'nr', 'both', 3120, 2400, 30, 5],
]

const SECTION_LIBRARY = [
  ['Preliminaries & Generals', 7], ['Main Distribution', 9], ['Lighting Installation', 14],
  ['Power & Small Power', 12], ['Earthing & Bonding', 8], ['Strip-out & Making Good', 4],
  ['Control & Emergency', 5], ['First Fix', 6], ['Second Fix', 6],
]

const SITES = [
  { address: 'Belmont Retail Centre, Rivonia Rd, Sandton', lat: -26.1052, lng: 28.0567 },
  { address: '128 Grayston Drive, Sandown, Johannesburg', lat: -26.1044, lng: 28.0553 },
  { address: '9 Steel Road, Wadeville, Germiston',        lat: -26.2531, lng: 28.1793 },
  { address: '44 Rivonia Road, Sandton',                  lat: -26.1076, lng: 28.0567 },
  { address: 'R114 Cedar Road, Broadacres, Fourways',     lat: -25.9899, lng: 28.0011 },
  { address: '17 Bompas Road, Dunkeld West, Johannesburg',lat: -26.1372, lng: 28.0359 },
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

// The wipe happens mid-run, so a process killed after it (a closed stdout pipe,
// Ctrl-C, a network blip) leaves the demo account EMPTY. Shout about it rather
// than failing silently — this script gets run right before live demos.
let wiped = false, completed = false
process.on('exit', () => {
  if (wiped && !completed) {
    try {
      process.stderr.write('\n!!! SEED DID NOT FINISH — the demo account is EMPTY. Re-run: node scripts/seed-elec-demo.mjs\n')
    } catch {}
  }
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(1))
// Never let a closed stdout (e.g. `| head`) kill the run part-way through.
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

async function run() {
  console.log(`\nSeeding electrician demo account — ${COMPANY}\n`)

  // ── 1. Auth user ───────────────────────────────────────────────────────────
  let userId
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = list?.users?.find(u => u.email === EMAIL)
  if (existingUser) {
    userId = existingUser.id
    // NEVER reset a password that already works: an admin password update revokes
    // every live session for that user, which boots anyone mid-demo. Probe first,
    // and only reset (loudly) if the documented password has actually drifted.
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
      contact_name:        'Dean Marais',
      phone:               '011 452 7700',
      address:             'Unit 12, Robertsham Industrial Park, 42 Kelvin Road, Robertsham, Johannesburg, 2091',
      description:         'Electrical contracting, maintenance and compliance',
      supplier_category:   'trades',
      plan:                'business',
      plan_category:       'electrician',
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
    await sb.from('elec_coc').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_snag_items').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_quote_line_items').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_variation_orders').delete().in('quote_id', oldQuoteIds)
    await sb.from('elec_quote_sections').delete().in('quote_id', oldQuoteIds)
  }
  for (const t of ['elec_material_requests', 'elec_notifications', 'elec_time_punches', 'elec_jobs',
                   'elec_job_cards', 'elec_coc', 'elec_quotes', 'elec_clients',
                   'elec_item_library', 'elec_section_library']) {
    await sb.from(t).delete().eq('portal_account_id', A)
  }
  wiped = true
  console.log('  · previous demo data cleared')

  // ── 3b. Company logo ───────────────────────────────────────────────────────
  // Source artwork: scripts/assets/nexus-demo-logo.html (render to PNG, then re-upload)
  let logoUrl = null
  try {
    const logoPath = new URL('./assets/nexus-demo-logo.png', import.meta.url)
    const logoBytes = readFileSync(logoPath)
    const storagePath = `supplier-portal/${A}/logo.png`
    const { error: upErr } = await sb.storage.from('branding')
      .upload(storagePath, logoBytes, { upsert: true, contentType: 'image/png' })
    if (upErr) throw new Error(upErr.message)
    const { data: pub } = sb.storage.from('branding').getPublicUrl(storagePath)
    logoUrl = `${pub.publicUrl}?t=${Date.now()}`
    await sb.from('supplier_portal_accounts').update({ logo_url: logoUrl }).eq('id', A)
    console.log('  · logo uploaded')
  } catch (e) {
    console.warn(`  ! logo skipped — ${e.message}`)
  }

  // ── 4. Settings ────────────────────────────────────────────────────────────
  await sb.from('elec_settings').upsert({
    portal_account_id:              A,
    company_code:                   CODE,
    cidb_registration_number:       '10234567/4EB',
    company_registration_number:    '2016/384512/07',
    vat_registration_number:        '4310287654',
    bank_name:                      'First National Bank',
    bank_account_number:            '628 4193 7265',
    bank_branch_code:               '250 655',
    bank_account_type:              'cheque',
    default_vat_rate:               15,
    default_retention_percentage:   10,
    default_payment_terms_days:     30,
    default_defects_liability_days: 90,
    quote_prefix:                   'QU',
    claim_prefix:                   'CLM',
    vo_prefix:                      'VO',
    coc_prefix:                     'COC',
    email_footer_text:              'Nexus Electrical (Demo) · Registered Electrical Contractor · Dept. of Labour Reg. EC-2016-4419 · CIDB 4EB',
    reg_person_name:                'Dean Marais',
    reg_person_id_no:               '8203125012083',
    reg_person_reg_no:              'MI-4419-2011',
    reg_person_reg_date:            '2011-03-14',
    reg_person_type:                'master',
    reg_person_address:             'Unit 12, Robertsham Industrial Park, 42 Kelvin Road, Robertsham, Johannesburg',
    reg_person_tel:                 '011 452 7700',
    reg_person_cell:                '082 441 7712',
    reg_person_email:               'dean@nexuselectrical.demo',
    contractor_name:                'Nexus Electrical (Demo)',
    contractor_reg_no:              'EC-2016-4419',
    contractor_reg_date:            '2016-08-02',
    contractor_address:             'Unit 12, Robertsham Industrial Park, 42 Kelvin Road, Robertsham, Johannesburg',
    contractor_tel:                 '011 452 7700',
    contractor_cell:                '082 441 7712',
    contractor_email:               'admin@nexuselectrical.demo',
  }, { onConflict: 'portal_account_id' })
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
    const { data: existingStaff } = await sb.from('elec_staff').select('id').eq('username', s.username).maybeSingle()
    let row, error
    if (existingStaff) {
      ({ data: row, error } = await sb.from('elec_staff').update(fields).eq('id', existingStaff.id).select('id').single())
    } else {
      ({ data: row, error } = await sb.from('elec_staff').insert(fields).select('id').single())
    }
    if (error) { console.error(`  ✗ staff ${s.name}: ${error.message}`); process.exit(1) }
    staffIds[s.name] = row.id

    // staff mobile auth user
    const sEmail = staffAuthEmail(s.username)
    const existingStaffUser = list?.users?.find(u => u.email === sEmail)
    let sUid
    if (existingStaffUser) {
      // Same rule as the owner account — resetting would kill live staff sessions.
      // The password is derived from the PIN, which never changes here.
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

  // ── 7. Libraries ───────────────────────────────────────────────────────────
  await ins('elec_item_library', ITEM_LIBRARY.map(([description, unit, item_type, rate, cost, markup, usage]) => ({
    portal_account_id: A, description, unit, item_type,
    default_unit_rate: rate, default_cost_rate: cost, default_markup_percent: markup, usage_count: usage,
  })))
  await ins('elec_section_library', SECTION_LIBRARY.map(([title, usage_count]) => ({ portal_account_id: A, title, usage_count })))
  console.log(`  · ${ITEM_LIBRARY.length} library items, ${SECTION_LIBRARY.length} section headings`)

  // ── 8. Quotes ──────────────────────────────────────────────────────────────
  let quoteSeq = 0, claimSeq = 0
  const quoteIds = {}
  let totalItems = 0, totalClaims = 0, totalVOs = 0

  for (const q of QUOTES) {
    quoteSeq += 1
    const quote_number = `${CODE}-QU-${YEAR}-${String(quoteSeq).padStart(3, '0')}`
    const [quoteRow] = await ins('elec_quotes', [{
      portal_account_id: A,
      client_id: clientIds[q.client],
      quote_number,
      project_name: q.project_name,
      project_address: q.project_address ?? null,
      description: q.description ?? null,
      project_type: q.project_type,
      contract_type: q.contract_type,
      status: q.status,
      vat_rate: 15,
      retention_percentage: q.retention_percentage ?? 0,
      payment_terms_days: q.payment_terms_days ?? 30,
      defects_liability_period_days: 90,
      drawing_reference: q.drawing_reference ?? null,
      quoted_date: q.quoted_date ?? null,
      approved_date: q.approved_date ?? null,
      expected_completion_date: q.expected_completion_date ?? null,
      practical_completion_date: q.practical_completion_date ?? null,
      created_by_name: 'Dean Marais',
      additional_staff_ids: [],
      is_quick_job: false,
    }])
    const qid = quoteRow.id
    quoteIds[q.key] = qid

    // sections + line items
    const lineItems = []
    let sortOrder = 0
    for (const [si, section] of q.sections.entries()) {
      const [secRow] = await ins('elec_quote_sections', [{ quote_id: qid, title: section.title, sort_order: si }])
      for (const item of section.items) {
        sortOrder += 1
        lineItems.push({
          quote_id: qid, section_id: secRow.id, sort_order: sortOrder,
          description: item.description, unit: item.unit, item_type: item.item_type,
          quoted_quantity: item.quoted_quantity,
          quoted_unit_rate: item.quoted_unit_rate,
          cost_unit_rate: item.cost_unit_rate,
          markup_percentage: item.markup_percentage,
          // in_progress / completed projects carry as-built quantities
          as_built_quantity: ['in_progress', 'completed'].includes(q.status)
            ? round2(item.quoted_quantity * (0.94 + (sortOrder % 5) * 0.03))
            : null,
          is_variation: false,
        })
      }
    }
    const savedItems = await ins('elec_quote_line_items', lineItems, 'id, quoted_quantity, quoted_unit_rate')
    totalItems += savedItems.length

    // variation orders
    for (const [vi, vo] of (q.vos ?? []).entries()) {
      await ins('elec_variation_orders', [{
        quote_id: qid,
        vo_number: `${CODE}-VO-${YEAR}-${String(vi + 1).padStart(3, '0')}`,
        description: vo.description,
        value: vo.value,
        cost_value: vo.cost_value ?? null,
        status: vo.status,
        requested_by: vo.requested_by ?? null,
        approved_by: vo.approved_by ?? null,
        approved_date: vo.approved_date ?? null,
      }])
      totalVOs += 1
    }

    // progress claims
    const client = CLIENTS.find(c => c.key === q.client)
    for (const claim of q.claims ?? []) {
      claimSeq += 1
      const claimLines = savedItems.map(it => {
        const contractVal = it.quoted_quantity * it.quoted_unit_rate
        return { quote_line_item_id: it.id, percentage_claimed: claim.pct, amount_claimed: round2(contractVal * claim.pct / 100) }
      })
      const totalClaimed = round2(claimLines.reduce((s, l) => s + l.amount_claimed, 0))
      const certified = ['certified', 'invoiced', 'paid'].includes(claim.status) ? round2(totalClaimed * 0.98) : null
      const invoiced  = ['invoiced', 'paid'].includes(claim.status) ? certified : null
      const paid      = claim.status === 'paid' ? invoiced : null

      const [claimRow] = await ins('elec_claims', [{
        quote_id: qid,
        portal_account_id: A,
        claim_number: `${CODE}-CLM-${YEAR}-${String(claimSeq).padStart(3, '0')}`,
        claim_date: claim.claim_date,
        period_month: claim.period,
        claim_type: 'invoice',
        status: claim.status,
        total_claimed: totalClaimed,
        total_certified: certified,
        total_invoiced: invoiced,
        total_paid: paid,
        sent_to_name: client?.client_name ?? null,
        sent_to_email: client?.email ?? null,
        sent_at: iso(new Date(claim.claim_date)),
        qs_name: client?.qs_name ?? null,
        qs_email: client?.qs_email ?? null,
        notes: claim.notes,
      }])
      await ins('elec_claim_line_items', claimLines.map(l => ({
        claim_id: claimRow.id, ...l,
        percentage_certified: certified ? claim.pct : null,
        amount_certified: certified ? round2(l.amount_claimed * 0.98) : null,
      })))
      totalClaims += 1
    }

    // snags
    if ((q.snags ?? []).length) {
      await ins('elec_snag_items', q.snags.map(s => ({ quote_id: qid, ...s })))
    }

    // project COC
    if (q.coc) {
      await ins('elec_coc', [{
        quote_id: qid,
        portal_account_id: A,
        coc_number: q.coc.coc_number,
        installation_description: q.coc.installation_description,
        installation_address: q.project_address,
        issue_date: q.coc.issue_date,
        valid_until: ymd(new Date(new Date(q.coc.issue_date).getTime() + 730 * DAY)),
        tester_name: 'Dean Marais',
        tester_registration_number: 'MI-4419-2011',
        owner_name: client?.client_name ?? null,
        supply_authority: 'City Power / Ekurhuleni',
        supply_voltage: '230/400V',
        supply_phases: q.coc.supply_phases ?? 'three',
        supply_earthing: 'TN-C-S',
        main_breaker_amps: q.coc.main_breaker_amps ?? null,
        work_type: q.coc.work_type ?? 'new',
        installation_type: q.coc.installation_type ?? 'commercial',
        certificate_type: 'initial',
        regulation_type: 'a',
        earth_continuity: 'pass', insulation_resistance: 'pass', polarity: 'pass',
        earth_leakage: 'pass', overcurrent_protection: 'pass', phase_rotation: 'pass',
        contractor_name: COMPANY,
        contractor_reg_no: 'EC-2016-4419',
        contractor_tel: '011 452 7700',
        contractor_email: 'admin@nexuselectrical.demo',
        reg_person_type: 'master',
        recipient_name: client?.client_name ?? null,
        recipient_date: q.coc.issue_date,
        test_report: {},
        photos: [],
        report_items: [],
      }])
    }
  }
  console.log(`  · ${QUOTES.length} projects, ${totalItems} line items, ${totalVOs} variation orders, ${totalClaims} progress claims`)

  // ── 9. Job cards ───────────────────────────────────────────────────────────
  let jcSeq = 0
  const jcIds = []
  for (const jc of JOB_CARDS) {
    jcSeq += 1
    const when = jc.days_ahead != null ? daysAhead(jc.days_ahead) : daysAgo(jc.days_ago)
    const [row] = await ins('elec_job_cards', [{
      portal_account_id: A,
      client_id: clientIds[jc.client],
      staff_id: staffIds[jc.staff],
      job_number: `JC-${String(jcSeq).padStart(4, '0')}`,
      job_type: jc.job_type,
      status: jc.status,
      title: jc.title,
      location: jc.location,
      scheduled_at: at(when, 8, 30),
      started_at: jc.status === 'pending' ? null : at(when, 8, 45),
      completed_at: jc.status === 'completed' ? at(when, 14, 20) : null,
      work_description: jc.work_description ?? null,
      work_found: jc.work_found ?? null,
      resolution: jc.resolution ?? null,
      client_name: CLIENTS.find(c => c.key === jc.client)?.client_name ?? null,
      client_email: CLIENTS.find(c => c.key === jc.client)?.email ?? null,
      callout_fee: jc.callout_fee ?? null,
      labour_hours: jc.labour_hours ?? null,
      labour_rate: jc.labour_rate ?? null,
      invoiced: jc.invoiced ?? false,
      created_by_name: 'Lerato Dlamini',
      additional_staff_ids: [],
      sent_to_name: jc.status === 'completed' ? (CLIENTS.find(c => c.key === jc.client)?.client_name ?? null) : null,
      sent_to_email: jc.status === 'completed' ? (CLIENTS.find(c => c.key === jc.client)?.email ?? null) : null,
      sent_at: jc.status === 'completed' ? at(when, 15, 10) : null,
    }])
    jcIds.push({ id: row.id, jc })
    if (jc.materials?.length) {
      await ins('elec_job_card_materials', jc.materials.map(m => ({
        job_card_id: row.id, description: m.description, qty: m.qty,
        unit_price: m.unit_price, cost_price: m.cost_price,
      })))
    }
  }
  console.log(`  · ${JOB_CARDS.length} job cards with materials`)

  // ── 10. Scheduled jobs (calendar) ──────────────────────────────────────────
  const schedule = [
    { title: 'Belmont — second fix, Shops 4 & 5',        staff: 'Sipho Ndlovu',  quote: 'belmont',  day: 1, start: '07:30', end: '16:30', address: 'Belmont Retail Centre, Sandton' },
    { title: 'Belmont — second fix, Shops 4 & 5',        staff: 'Riaan Botha',   quote: 'belmont',  day: 1, start: '07:30', end: '16:30', address: 'Belmont Retail Centre, Sandton' },
    { title: 'Grayston Block C — LED panel installation', staff: 'Thabo Mokoena', quote: 'grayston', day: 2, start: '08:00', end: '17:00', address: '128 Grayston Drive, Sandown' },
    { title: 'Riverside Lodge — monthly maintenance',     staff: 'Johan van Wyk', quote: null,       day: 3, start: '08:00', end: '12:00', address: 'R114 Cedar Road, Broadacres' },
    { title: 'Belmont — earthing and bonding',            staff: 'Sipho Ndlovu',  quote: 'belmont',  day: 4, start: '07:30', end: '16:30', address: 'Belmont Retail Centre, Sandton' },
    { title: 'Sandton Ridge — DB delivery and set-out',   staff: 'Thabo Mokoena', quote: 'sandton',  day: 5, start: '08:00', end: '15:00', address: '44 Rivonia Road, Sandton' },
    { title: 'Grayston Block C — floor box installation', staff: 'Johan van Wyk', quote: 'grayston', day: 8, start: '08:00', end: '17:00', address: '128 Grayston Drive, Sandown' },
    { title: 'Kruger — Warehouse 2 COC inspection',       staff: 'Dean Marais',   quote: null,       day: 9, start: '09:00', end: '14:00', address: '9 Steel Road, Wadeville' },
  ]
  await ins('elec_jobs', schedule.map(s => ({
    portal_account_id: A,
    quote_id: s.quote ? quoteIds[s.quote] : null,
    staff_id: staffIds[s.staff],
    title: s.title,
    address: s.address,
    scheduled_date: ymd(daysAhead(s.day)),
    start_time: s.start,
    end_time: s.end,
    status: 'scheduled',
  })))
  console.log(`  · ${schedule.length} scheduled jobs`)

  // ── 11. Time punches — last 3 working weeks ────────────────────────────────
  const fieldStaff = ['Sipho Ndlovu', 'Johan van Wyk', 'Thabo Mokoena', 'Riaan Botha']
  const punches = []
  for (let d = 21; d >= 0; d--) {
    const day = daysAgo(d)
    const dow = day.getDay()
    if (dow === 0 || dow === 6) continue
    for (const [i, name] of fieldStaff.entries()) {
      const site = SITES[(d + i) % SITES.length]
      const inMin  = 25 + ((d * 7 + i * 11) % 30)          // 07:25 – 07:55
      const outMin = 20 + ((d * 5 + i * 13) % 45)          // 16:20 – 17:05
      const jitter = () => (Math.random() - 0.5) * 0.0018
      punches.push({
        portal_account_id: A, staff_id: staffIds[name], punch_type: 'clock_in',
        punched_at: at(day, 7, inMin), latitude: site.lat + jitter(),
        longitude: site.lng + jitter(), address: site.address,
      })
      // today: leave two staff still clocked in
      const stillOut = d === 0 && i < 2
      if (!stillOut) {
        punches.push({
          portal_account_id: A, staff_id: staffIds[name], punch_type: 'clock_out',
          punched_at: at(day, 16, outMin), latitude: site.lat + jitter(),
          longitude: site.lng + jitter(), address: site.address,
        })
      }
    }
  }
  // fix latitude rounding artefact
  for (const p of punches) p.latitude = Number(p.latitude.toFixed(6)), p.longitude = Number(p.longitude.toFixed(6))
  await ins('elec_time_punches', punches)
  console.log(`  · ${punches.length} time punches (last 3 weeks, GPS tagged)`)

  // ── 12. Material requests ──────────────────────────────────────────────────
  await ins('elec_material_requests', [
    { portal_account_id: A, source_type: 'project',    quote_id: quoteIds.belmont,  description: '16A double switched socket outlet — white',          qty: 24, unit: 'nr', status: 'pending',  requested_by_staff_id: staffIds['Sipho Ndlovu'],  requested_by_name: 'Sipho Ndlovu',  notes: 'Needed for Shop 5 second fix on Thursday.' },
    { portal_account_id: A, source_type: 'project',    quote_id: quoteIds.belmont,  description: '2.5mm² surfix cable — 100m roll',                    qty: 4,  unit: 'roll', status: 'ordered', requested_by_staff_id: staffIds['Sipho Ndlovu'],  requested_by_name: 'Sipho Ndlovu',  supplier: 'Voltex Robertsham', ordered_at: iso(daysAgo(2)) },
    { portal_account_id: A, source_type: 'project',    quote_id: quoteIds.grayston, description: '600x600 LED panel 36W recessed',                     qty: 32, unit: 'nr', status: 'received', requested_by_staff_id: staffIds['Thabo Mokoena'], requested_by_name: 'Thabo Mokoena', supplier: 'ARB Electrical', ordered_at: iso(daysAgo(9)), received_at: iso(daysAgo(4)) },
    { portal_account_id: A, source_type: 'job_card', job_card_id: jcIds[7].id,    description: '12V 5A regulated power supply unit',                 qty: 1,  unit: 'nr', status: 'ordered',  requested_by_staff_id: staffIds['Riaan Botha'],   requested_by_name: 'Riaan Botha',   supplier: 'Communica', ordered_at: iso(daysAgo(1)) },
    { portal_account_id: A, source_type: 'job_card', job_card_id: jcIds[6].id,    description: '63A 3-phase circuit breaker — curve C',              qty: 2,  unit: 'nr', status: 'pending',  requested_by_staff_id: staffIds['Sipho Ndlovu'],  requested_by_name: 'Sipho Ndlovu',  notes: 'For hot joints identified on Block A floor 2 DB.' },
  ])
  console.log('  · 5 material requests')

  // ── 13. Notifications ──────────────────────────────────────────────────────
  await ins('elec_notifications', [
    { portal_account_id: A, type: 'clock_in',         title: 'Sipho Ndlovu clocked in',                 body: 'Clocked in · Belmont Retail Centre, Rivonia Rd, Sandton', created_at: at(daysAgo(0), 7, 32), metadata: {} },
    { portal_account_id: A, type: 'job_card_created', title: 'New job card JC-0009',                    body: '"Shop 4 tripping on kitchen equipment"',                  created_at: at(daysAgo(0), 9, 5),  metadata: {} },
    { portal_account_id: A, type: 'material_request', title: 'Material request from Riaan Botha',       body: '12V 5A regulated power supply unit × 1',                  created_at: at(daysAgo(1), 11, 40), metadata: {} },
    { portal_account_id: A, type: 'job_card_photo',   title: 'Photos added to JC-0007',                 body: 'Sipho Ndlovu added 3 photos',                             created_at: at(daysAgo(1), 14, 12), metadata: {} },
    { portal_account_id: A, type: 'clock_out',        title: 'Thabo Mokoena clocked out',               body: 'Clocked out · 128 Grayston Drive, Sandown',               created_at: at(daysAgo(1), 16, 48), metadata: {}, read_at: iso(daysAgo(1)) },
    { portal_account_id: A, type: 'invoice',          title: 'Claim NEX-CLM-2026-003 submitted',        body: 'Belmont Retail Centre — Electrical Installation',         created_at: at(daysAgo(9), 10, 22), metadata: {}, read_at: iso(daysAgo(8)) },
  ])
  console.log('  · 6 notifications')

  // ── verify ─────────────────────────────────────────────────────────────────
  const expected = {
    elec_clients: CLIENTS.length, elec_quotes: QUOTES.length, elec_job_cards: JOB_CARDS.length,
    elec_staff: STAFF.length, elec_jobs: schedule.length, elec_time_punches: punches.length,
  }
  const wrong = []
  for (const [table, want] of Object.entries(expected)) {
    const { count } = await sb.from(table).select('*', { count: 'exact', head: true }).eq('portal_account_id', A)
    if (count !== want) wrong.push(`${table}: expected ${want}, found ${count}`)
  }
  if (wrong.length) { console.error('\n  ✗ VERIFY FAILED\n    ' + wrong.join('\n    ')); process.exit(1) }
  completed = true

  // ── done ───────────────────────────────────────────────────────────────────
  console.log(`
─────────────────────────────────────────────────────────────
  DEMO ACCOUNT READY — ${COMPANY}
─────────────────────────────────────────────────────────────
  Portal   https://quotinghub.co.za/supplier-portal/login
  Email    ${EMAIL}
  Password ${PASSWORD}

  Staff mobile app  /supplier-portal/login  →  "Staff sign in"
${STAFF.map(s => `    ${s.username.padEnd(10)} PIN ${s.pin}   ${s.name} (${s.role})`).join('\n')}
─────────────────────────────────────────────────────────────
`)
}

run().catch(e => { console.error(e); process.exit(1) })
