// Creates a fully-seeded shared demo account for QuotingHub sales demos.
// Run: node create-demo-account.mjs
// Safe to run multiple times — skips steps already completed.
//
// Login after running:
//   URL:      https://quotinghub.co.za
//   Email:    demo@quotinghub.co.za
//   Password: StudioDemo1!

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ysssvfmwzdfnsxbxraee.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3N2Zm13emRmbnN4YnhyYWVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxMjU5OCwiZXhwIjoyMDg5NTg4NTk4fQ.IMx8YjjPBb2BRz2T60b5i5_wUy4rcve4UDJtuK_IrLk'
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const DEMO_EMAIL    = 'demo@quotinghub.co.za'
const DEMO_INBOX    = 'demodata@quotinghub.co.za'  // all client/supplier emails redirect here
const DEMO_PASSWORD = 'StudioDemo1!'
const DEMO_NAME     = 'Studio Demo'
const ORG_NAME      = 'Studio Demo Interior Design'

// ─── Markup helper ────────────────────────────────────────────────────────────
const mkp = (supplier) => supplier?.markup_percentage ?? 35

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {

  // ── 1. Auth user ────────────────────────────────────────────────────────────
  let userId
  const { data: { users } } = await sb.auth.admin.listUsers()
  const existingUser = users.find(u => u.email === DEMO_EMAIL)

  if (existingUser) {
    userId = existingUser.id
    console.log(`Auth user already exists: ${userId}`)
  } else {
    const { data: { user }, error } = await sb.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,           // no email verification needed for demo
      user_metadata: { full_name: DEMO_NAME },
      app_metadata:  { is_self_signup: true },
    })
    if (error) throw error
    userId = user.id
    console.log(`Created auth user: ${userId}`)
  }

  // ── 2. Organisation ─────────────────────────────────────────────────────────
  let orgId
  const { data: existingMember } = await sb
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (existingMember) {
    orgId = existingMember.org_id
    console.log(`Org already exists: ${orgId}`)
  } else {
    const { data: org, error: orgErr } = await sb
      .from('organizations')
      .insert({ name: ORG_NAME })
      .select('id')
      .single()
    if (orgErr) throw orgErr
    orgId = org.id

    const { error: memErr } = await sb.from('org_members').insert({
      org_id: orgId,
      user_id: userId,
      invited_email: DEMO_EMAIL,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString(),
      full_name: DEMO_NAME,
    })
    if (memErr) throw memErr
    console.log(`Created org + member: ${orgId}`)
  }

  // ── 3. Settings ──────────────────────────────────────────────────────────────
  const { data: existingSettings } = await sb
    .from('settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingSettings) {
    const { error: setErr } = await sb.from('settings').insert({
      user_id: userId,
      org_id: orgId,
      business_name: 'Studio Demo Interior Design',
      email_from: 'quotes@studiodemo.co.za',
      vat_rate: 15,
      deposit_percentage: 60,
      footer_text: 'Thank you for your business. All prices are valid for 30 days. A 60% deposit confirms your order.',
    })
    if (setErr) throw setErr
    console.log('Created settings')
  } else {
    console.log('Settings already exist')
  }

  // ── 4. Suppliers ─────────────────────────────────────────────────────────────
  const { data: existingSuppliers } = await sb
    .from('suppliers')
    .select('id, supplier_name, markup_percentage')
    .eq('org_id', orgId)

  let sA, sB, sC
  if (existingSuppliers?.length >= 3) {
    [sA, sB, sC] = existingSuppliers
    console.log('Suppliers already exist')
  } else {
    const suppliersToInsert = [
      {
        org_id: orgId, user_id: userId,
        supplier_name: 'Source Interiors',
        category: 'Furniture & Upholstery',
        contact_person: 'Taryn Louw',
        contact_number: '+27 21 555 0210',
        rep_name: 'Taryn Louw',
        rep_number: '+27 21 555 0210',
        email: DEMO_INBOX,
        markup_percentage: 40,
      },
      {
        org_id: orgId, user_id: userId,
        supplier_name: 'Trent Furniture Co.',
        category: 'Custom Joinery & Cabinetry',
        contact_person: 'Brendan Trent',
        contact_number: '+27 11 444 0780',
        rep_name: 'Brendan Trent',
        rep_number: '+27 11 444 0780',
        email: DEMO_INBOX,
        markup_percentage: 35,
      },
      {
        org_id: orgId, user_id: userId,
        supplier_name: 'Aura Lighting Studio',
        category: 'Lighting',
        contact_person: 'Simone Adler',
        contact_number: '+27 11 888 0320',
        rep_name: 'Simone Adler',
        rep_number: '+27 11 888 0320',
        email: DEMO_INBOX,
        markup_percentage: 45,
      },
    ]
    const { data: newSuppliers, error: supErr } = await sb
      .from('suppliers')
      .insert(suppliersToInsert)
      .select('id, supplier_name, markup_percentage')
    if (supErr) throw supErr;
    [sA, sB, sC] = newSuppliers
    console.log(`Created ${newSuppliers.length} suppliers`)
  }

  // ── 5. Clients ───────────────────────────────────────────────────────────────
  const { data: existingClients } = await sb
    .from('clients')
    .select('id, client_name')
    .eq('org_id', orgId)

  let clientA, clientB, clientC
  if (existingClients?.length >= 3) {
    [clientA, clientB, clientC] = existingClients
    console.log('Clients already exist')
  } else {
    const clientsToInsert = [
      {
        org_id: orgId, user_id: userId,
        client_name: 'Melissa van der Berg',
        company: null,
        email: DEMO_INBOX,
        contact_number: '+27 82 111 2233',
        address: '14 Sandton Drive, Sandton, Johannesburg, 2196',
      },
      {
        org_id: orgId, user_id: userId,
        client_name: 'The Hartley Family',
        company: null,
        email: DEMO_INBOX,
        contact_number: '+27 83 222 3344',
        address: '7 Bishops Court, Constantia, Cape Town, 7806',
      },
      {
        org_id: orgId, user_id: userId,
        client_name: 'Nadia & Marc Fourie',
        company: null,
        email: DEMO_INBOX,
        contact_number: '+27 71 333 4455',
        address: '22 Waterfall Estate, Midrand, 1682',
      },
    ]
    const { data: newClients, error: cliErr } = await sb
      .from('clients')
      .insert(clientsToInsert)
      .select('id, client_name')
    if (cliErr) throw cliErr;
    [clientA, clientB, clientC] = newClients
    console.log(`Created ${newClients.length} clients`)
  }

  // ── 6. Projects ──────────────────────────────────────────────────────────────
  const { data: existingProjects } = await sb
    .from('projects')
    .select('id, project_name')
    .eq('org_id', orgId)

  if (existingProjects?.length) {
    console.log('Projects already exist — skipping line items')
    printSummary(existingProjects[0].id)
    return
  }

  // ── Project A: Active quote (in progress) ────────────────────────────────────
  const { data: projA, error: pAErr } = await sb.from('projects').insert({
    org_id: orgId, user_id: userId,
    project_name: 'Sandton Penthouse — Full FF&E',
    project_number: 'SD-2025-001',
    client_id: clientA.id,
    date: '2025-05-01',
    status: 'Quote',
    design_fee: 45000,
    vat_rate: 15,
    deposit_percentage: 60,
    notes: 'Full FF&E package for a 3-bedroom penthouse in Sandton. Client approved mood board.',
  }).select('id').single()
  if (pAErr) throw pAErr

  await sb.from('project_stages').insert({
    project_id: projA.id,
    quote_sent: true,  quote_sent_at: new Date('2025-05-05').toISOString(),
    deposit_received: false, pos_sent: false, fabrics_received: false,
    fabrics_sent: false, final_invoice_sent: false, final_invoice_paid: false,
    delivered_installed: false,
  })

  const lineItemsA = [
    { row_type: 'section', item_name: 'LIVING ROOM', sort_order: 1 },
    {
      row_type: 'item', sort_order: 2,
      item_name: 'Bespoke Modular Sofa',
      description: '3-piece modular sofa in performance bouclé — Cloud White. Solid walnut legs, feather-blend cushions. 3 200 mm overall.',
      quantity: 1, unit: 'set',
      cost_price: 38500, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '3200 × 900 × 780 mm', colour_finish: 'Cloud White Bouclé / Walnut', lead_time_weeks: 10,
    },
    {
      row_type: 'item', sort_order: 3,
      item_name: 'Oval Marble Coffee Table',
      description: 'Calacatta Gold marble top, brushed brass base. Honed finish.',
      quantity: 1, unit: 'each',
      cost_price: 14200, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '1200 × 650 × 400 mm', colour_finish: 'Calacatta Gold / Brushed Brass', lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 4,
      item_name: 'Accent Lounge Chair × 2',
      description: 'Barrel-back lounge chair in sage green velvet. Matte black powder-coated steel base.',
      quantity: 2, unit: 'each',
      cost_price: 7800, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '820 × 820 × 780 mm', colour_finish: 'Sage Green Velvet / Matt Black', lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 5,
      item_name: 'Arched Floor Lamp',
      description: 'Arched brass floor lamp with linen shade. Dimmable E27 LED included.',
      quantity: 1, unit: 'each',
      cost_price: 4900, markup_percentage: mkp(sC),
      supplier_id: sC.id, supplier_name: sC.supplier_name,
      dimensions: 'H: 1800 mm', colour_finish: 'Antique Brass / Natural Linen', lead_time_weeks: 4,
    },
    {
      row_type: 'item', sort_order: 6,
      item_name: 'Custom TV Unit — Woodwork',
      description: 'Smoked oak veneer wall unit with push-to-open cabinets, integrated LED strip and open shelving. Nero Marquina stone top.',
      quantity: 1, unit: 'each',
      cost_price: 52000, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '3600 × 450 × 2100 mm', colour_finish: 'Smoked Oak / Nero Marquina', lead_time_weeks: 12,
    },
    {
      row_type: 'item', sort_order: 7,
      item_name: 'Wool Area Rug',
      description: 'Hand-knotted wool rug in warm sand tones. Custom size.',
      quantity: 1, unit: 'each',
      cost_price: 18600, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '3000 × 2000 mm', colour_finish: 'Sand / Ivory / Warm Taupe', lead_time_weeks: 14,
    },
    { row_type: 'section', item_name: 'DINING ROOM', sort_order: 8 },
    {
      row_type: 'item', sort_order: 9,
      item_name: 'Dining Table',
      description: 'Solid white oak dining table with chamfered legs. Satin lacquer finish.',
      quantity: 1, unit: 'each',
      cost_price: 22000, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '2400 × 1000 × 750 mm', colour_finish: 'White Oak / Satin Lacquer', lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 10,
      item_name: 'Dining Chair × 8',
      description: 'Upholstered dining chair in terracotta boucle. Natural oak legs.',
      quantity: 8, unit: 'each',
      cost_price: 3400, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '460 × 540 × 890 mm', colour_finish: 'Terracotta Bouclé / Natural Oak', lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 11,
      item_name: 'Pendant Light — Dining',
      description: 'Smoked glass cluster pendant, 3-drop configuration. Dimmable warm white LEDs.',
      quantity: 1, unit: 'set',
      cost_price: 8900, markup_percentage: mkp(sC),
      supplier_id: sC.id, supplier_name: sC.supplier_name,
      dimensions: '∅ 800 mm, Drop 600 mm', colour_finish: 'Smoked Glass / Brushed Gold', lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 12,
      item_name: 'Sideboard',
      description: 'Walnut veneer sideboard with 4-door push-to-open storage. Satin brass handles.',
      quantity: 1, unit: 'each',
      cost_price: 16800, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '2000 × 450 × 800 mm', colour_finish: 'Walnut / Satin Brass', lead_time_weeks: 10,
    },
    { row_type: 'section', item_name: 'MASTER BEDROOM', sort_order: 13 },
    {
      row_type: 'item', sort_order: 14,
      item_name: 'Upholstered Bedhead (King)',
      description: 'Floor-to-ceiling padded bedhead in ivory performance linen. Integrated side wings.',
      quantity: 1, unit: 'each',
      cost_price: 12500, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '2200 × 100 × 1800 mm', colour_finish: 'Ivory Linen', lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 15,
      item_name: 'Bedside Table × 2',
      description: 'Floating walnut bedside table with single drawer and inset brass handle.',
      quantity: 2, unit: 'each',
      cost_price: 4200, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '550 × 380 × 500 mm', colour_finish: 'Walnut / Satin Brass', lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 16,
      item_name: 'Bespoke Built-In Wardrobe',
      description: 'Full-height built-in wardrobe, painted MDF carcass with fluted oak door fronts. Push-to-open.',
      quantity: 1, unit: 'each',
      cost_price: 68000, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '3800 × 620 × 2400 mm', colour_finish: 'Fluted White Oak / White Carcass', lead_time_weeks: 14,
    },
  ]
  await insertLineItems(projA.id, lineItemsA)
  console.log(`Created Project A (Quote): ${projA.id}`)

  // ── Project B: Invoice (deposit received, POs sent) ───────────────────────────
  const { data: projB, error: pBErr } = await sb.from('projects').insert({
    org_id: orgId, user_id: userId,
    project_name: 'Constantia Villa — Living & Dining',
    project_number: 'SD-2025-002',
    client_id: clientB.id,
    date: '2025-03-15',
    status: 'Invoice',
    design_fee: 28000,
    vat_rate: 15,
    deposit_percentage: 60,
    notes: 'Living and dining refresh. Deposit received, POs placed with suppliers.',
  }).select('id').single()
  if (pBErr) throw pBErr

  await sb.from('project_stages').insert({
    project_id: projB.id,
    quote_sent: true,  quote_sent_at: new Date('2025-03-18').toISOString(),
    deposit_received: true, deposit_received_at: new Date('2025-03-22').toISOString(),
    pos_sent: true, pos_sent_at: new Date('2025-03-25').toISOString(),
    fabrics_received: false, fabrics_sent: false,
    final_invoice_sent: false, final_invoice_paid: false,
    delivered_installed: false,
  })

  const lineItemsB = [
    { row_type: 'section', item_name: 'LIVING ROOM', sort_order: 1 },
    {
      row_type: 'item', sort_order: 2,
      item_name: 'L-Shape Sectional Sofa',
      description: 'Stone linen fabric sectional with chaise. Down-blend cushions. Solid oak feet.',
      quantity: 1, unit: 'set',
      cost_price: 42000, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '3400 × 2200 × 820 mm', colour_finish: 'Stone Linen / Oak', lead_time_weeks: 10,
    },
    {
      row_type: 'item', sort_order: 3,
      item_name: 'Nesting Side Tables × 2',
      description: 'Set of 2 travertine-top nesting tables on brushed brass frames.',
      quantity: 1, unit: 'set',
      cost_price: 9200, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      colour_finish: 'Travertine / Brushed Brass', lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 4,
      item_name: 'Chandelier — Living',
      description: 'Sculptural plaster chandelier with integrated LED. Dimmable.',
      quantity: 1, unit: 'each',
      cost_price: 18500, markup_percentage: mkp(sC),
      supplier_id: sC.id, supplier_name: sC.supplier_name,
      dimensions: '∅ 900 mm, Drop 700 mm', colour_finish: 'Plaster White / Warm LED', lead_time_weeks: 8,
    },
    { row_type: 'section', item_name: 'DINING ROOM', sort_order: 5 },
    {
      row_type: 'item', sort_order: 6,
      item_name: 'Round Dining Table',
      description: 'Marble-top round dining table on gunmetal pedestal base.',
      quantity: 1, unit: 'each',
      cost_price: 26000, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '∅ 1400 × 750 mm', colour_finish: 'Arabescato Marble / Gunmetal', lead_time_weeks: 10,
    },
    {
      row_type: 'item', sort_order: 7,
      item_name: 'Upholstered Dining Chair × 6',
      description: 'Fully upholstered dining chair in forest green velvet. Brushed brass legs.',
      quantity: 6, unit: 'each',
      cost_price: 4800, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '480 × 520 × 880 mm', colour_finish: 'Forest Green Velvet / Brushed Brass', lead_time_weeks: 8,
    },
  ]
  await insertLineItems(projB.id, lineItemsB)
  console.log(`Created Project B (Invoice): ${projB.id}`)

  // ── Project C: Completed ──────────────────────────────────────────────────────
  const { data: projC, error: pCErr } = await sb.from('projects').insert({
    org_id: orgId, user_id: userId,
    project_name: 'Midrand Home Office',
    project_number: 'SD-2024-008',
    client_id: clientC.id,
    date: '2024-10-01',
    status: 'Completed',
    design_fee: 12500,
    vat_rate: 15,
    deposit_percentage: 60,
    notes: 'Home office fit-out. Fully completed and paid.',
  }).select('id').single()
  if (pCErr) throw pCErr

  await sb.from('project_stages').insert({
    project_id: projC.id,
    quote_sent: true,  quote_sent_at: new Date('2024-10-05').toISOString(),
    deposit_received: true, deposit_received_at: new Date('2024-10-09').toISOString(),
    pos_sent: true, pos_sent_at: new Date('2024-10-10').toISOString(),
    fabrics_received: true, fabrics_received_at: new Date('2024-10-24').toISOString(),
    fabrics_sent: true, fabrics_sent_at: new Date('2024-10-25').toISOString(),
    final_invoice_sent: true, final_invoice_sent_at: new Date('2024-11-10').toISOString(),
    final_invoice_paid: true, final_invoice_paid_at: new Date('2024-11-14').toISOString(),
    delivered_installed: true, delivered_installed_at: new Date('2024-11-20').toISOString(),
  })

  const lineItemsC = [
    { row_type: 'section', item_name: 'HOME OFFICE', sort_order: 1 },
    {
      row_type: 'item', sort_order: 2,
      item_name: 'Bespoke Executive Desk',
      description: 'Solid walnut desktop with integrated cable management. Powder-coated steel legs.',
      quantity: 1, unit: 'each',
      cost_price: 18500, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '2000 × 900 × 750 mm', colour_finish: 'Walnut / Black Steel', lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 3,
      item_name: 'Bookcase — Full Height',
      description: 'Painted MDF bookcase with adjustable shelves and integrated lighting strip.',
      quantity: 1, unit: 'each',
      cost_price: 14000, markup_percentage: mkp(sB),
      supplier_id: sB.id, supplier_name: sB.supplier_name,
      dimensions: '2400 × 400 × 2600 mm', colour_finish: 'Chalk White / Warm LED strip', lead_time_weeks: 10,
    },
    {
      row_type: 'item', sort_order: 4,
      item_name: 'Task Lighting — Desk Lamp',
      description: 'Articulating arm task lamp in polished brass. Dimmable.',
      quantity: 1, unit: 'each',
      cost_price: 3200, markup_percentage: mkp(sC),
      supplier_id: sC.id, supplier_name: sC.supplier_name,
      colour_finish: 'Polished Brass', lead_time_weeks: 3,
    },
    {
      row_type: 'item', sort_order: 5,
      item_name: 'Acoustic Panel Set',
      description: 'Wall-mounted acoustic panels in herringbone wool. Set of 6.',
      quantity: 1, unit: 'set',
      cost_price: 6800, markup_percentage: mkp(sA),
      supplier_id: sA.id, supplier_name: sA.supplier_name,
      dimensions: '600 × 1200 mm per panel', colour_finish: 'Warm Charcoal Herringbone Wool', lead_time_weeks: 5,
    },
  ]
  await insertLineItems(projC.id, lineItemsC)
  console.log(`Created Project C (Completed): ${projC.id}`)

  printSummary(projA.id)
}

async function insertLineItems(projectId, items) {
  const rows = items.map(item => ({
    project_id: projectId,
    row_type: item.row_type,
    item_name: item.item_name,
    description: item.description ?? null,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? null,
    cost_price: item.cost_price ?? 0,
    markup_percentage: item.markup_percentage ?? 0,
    sort_order: item.sort_order,
    supplier_id: item.supplier_id ?? null,
    supplier_name: item.supplier_name ?? null,
    dimensions: item.dimensions ?? null,
    colour_finish: item.colour_finish ?? null,
    lead_time_weeks: item.lead_time_weeks ?? null,
    received: false,
    indent_level: 0,
  }))
  const { error } = await sb.from('line_items').insert(rows)
  if (error) throw error
}

function printSummary(firstProjectId) {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           DEMO ACCOUNT READY                             ║
╠══════════════════════════════════════════════════════════╣
║  URL:      https://quotinghub.co.za                      ║
║  Email:    demo@quotinghub.co.za                         ║
║  Password: StudioDemo1!                                  ║
╠══════════════════════════════════════════════════════════╣
║  Organisation:  Studio Demo Interior Design              ║
║  Projects:      3 (Quote, Invoice, Completed)            ║
║  Suppliers:     3  (Source, Trent, Aura)                 ║
║  Clients:       3                                        ║
╠══════════════════════════════════════════════════════════╣
║  First project:                                          ║
║  https://quotinghub.co.za/projects/${firstProjectId}
╚══════════════════════════════════════════════════════════╝
  `)
}

main().catch(e => { console.error(e); process.exit(1) })
