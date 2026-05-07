// One-shot demo seed: creates QH Designer client + project + line items
// Run: node seed-demo.mjs
// Safe to run multiple times — checks for existing data first

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ysssvfmwzdfnsxbxraee.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc3N2Zm13emRmbnN4YnhyYWVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAxMjU5OCwiZXhwIjoyMDg5NTg4NTk4fQ.IMx8YjjPBb2BRz2T60b5i5_wUy4rcve4UDJtuK_IrLk'
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // Hardcoded — R Kaplan Interiors org
  const userId = 'e47b9608-4c94-4205-871e-2d8d97c11527'  // warren@kaplan.co.za
  const orgId  = '2ff955ab-03bd-43d9-af57-a19dd374f015'
  console.log(`Using org: ${orgId}`)

  // 3. Create client (skip if already exists)
  let clientId
  const { data: existingClient } = await supabase.from('clients').select('id').eq('org_id', orgId).eq('client_name', 'QH Designer').maybeSingle()
  if (existingClient) {
    clientId = existingClient.id
    console.log(`Client already exists: ${clientId}`)
  } else {
    const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
      org_id: orgId,
      user_id: userId,
      client_name: 'QH Designer',
      company: 'QH Interior Design Studio',
      email: 'hello@qhdesigner.co.za',
      contact_number: '+27 11 555 0100',
      address: '14 Sandton Drive, Sandton, Johannesburg, 2196',
    }).select('id').single()
    if (clientErr) throw clientErr
    clientId = newClient.id
    console.log(`Created client: ${clientId}`)
  }

  // 4. Find a supplier to attach to line items (use first available or null)
  const { data: suppliers } = await supabase.from('suppliers').select('id, supplier_name, markup_percentage').eq('org_id', orgId).order('supplier_name').limit(5)
  const supplierA = suppliers?.[0] ?? null
  const supplierB = suppliers?.[1] ?? supplierA

  // 5. Create project
  const { data: existingProject } = await supabase.from('projects').select('id').eq('org_id', orgId).eq('project_name', 'Sandown Penthouse — Full FF&E').maybeSingle()
  let projectId
  if (existingProject) {
    projectId = existingProject.id
    console.log(`Project already exists: ${projectId}`)
  } else {
    const { data: newProject, error: projErr } = await supabase.from('projects').insert({
      org_id: orgId,
      user_id: userId,
      project_name: 'Sandown Penthouse — Full FF&E',
      project_number: 'QH-2025-001',
      client_id: clientId,
      date: '2025-05-01',
      status: 'Quote',
      design_fee: 45000,
      vat_rate: 15,
      deposit_percentage: 60,
      notes: 'Demo project for QuotingHub showcase. Full FF&E package for a 3-bedroom penthouse in Sandton.',
    }).select('id').single()
    if (projErr) throw projErr
    projectId = newProject.id
    console.log(`Created project: ${projectId}`)

    // Create project stages (quote sent)
    await supabase.from('project_stages').insert({
      project_id: projectId,
      quote_sent: true,
      quote_sent_at: new Date().toISOString(),
      deposit_received: false,
      pos_sent: false,
      fabrics_received: false,
      fabrics_sent: false,
      final_invoice_sent: false,
      final_invoice_paid: false,
      delivered_installed: false,
    })
  }

  // 6. Check if line items already exist
  const { data: existingItems } = await supabase.from('line_items').select('id').eq('project_id', projectId).limit(1)
  if (existingItems?.length) {
    console.log('Line items already exist — skipping')
    console.log(`\n✅ Done. Visit: https://quotinghub.co.za/projects/${projectId}`)
    return
  }

  // 7. Build line items
  const mkp = (supplier) => supplier?.markup_percentage ?? 35

  const lineItems = [
    // ── LIVING ROOM ──────────────────────────────────────────────────────────
    { row_type: 'section', item_name: 'LIVING ROOM', sort_order: 1 },
    {
      row_type: 'item', sort_order: 2,
      item_name: 'Bespoke Modular Sofa',
      description: '3-piece modular sofa in performance bouclé — Cloud White. Solid walnut legs, feather-blend cushions. 3 200 mm overall width.',
      quantity: 1, unit: 'set',
      cost_price: 38500, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '3200 × 900 × 780 mm', colour_finish: 'Cloud White Bouclé / Walnut',
      lead_time_weeks: 10,
    },
    {
      row_type: 'item', sort_order: 3,
      item_name: 'Oval Marble Coffee Table',
      description: 'Calacatta Gold marble top, brushed brass base. Honed finish.',
      quantity: 1, unit: 'each',
      cost_price: 14200, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '1200 × 650 × 400 mm', colour_finish: 'Calacatta Gold / Brushed Brass',
      lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 4,
      item_name: 'Accent Lounge Chair × 2',
      description: 'Barrel-back lounge chair in sage green velvet. Matte black powder-coated steel base.',
      quantity: 2, unit: 'each',
      cost_price: 7800, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '820 × 820 × 780 mm', colour_finish: 'Sage Green Velvet / Matt Black',
      lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 5,
      item_name: 'Floor-Standing Lamp',
      description: 'Arched brass floor lamp with linen shade. Dimmable, E27 LED bulb included.',
      quantity: 1, unit: 'each',
      cost_price: 4900, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: 'H: 1 800 mm', colour_finish: 'Antique Brass / Natural Linen',
      lead_time_weeks: 4,
    },
    {
      row_type: 'item', sort_order: 6,
      item_name: 'Custom TV Unit — Woodwork',
      description: 'Smoked oak veneer wall unit with push-to-open cabinets, integrated LED strip lighting and open display shelving. Stone top in Nero Marquina.',
      quantity: 1, unit: 'each',
      cost_price: 52000, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: '3600 × 450 × 2100 mm', colour_finish: 'Smoked Oak / Nero Marquina',
      lead_time_weeks: 12,
    },
    {
      row_type: 'item', sort_order: 7,
      item_name: 'Wool Area Rug',
      description: 'Hand-knotted wool rug in warm sand tones. Custom size.',
      quantity: 1, unit: 'each',
      cost_price: 18600, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '3000 × 2000 mm', colour_finish: 'Sand / Ivory / Warm Taupe',
      lead_time_weeks: 14,
    },

    // ── DINING ROOM ──────────────────────────────────────────────────────────
    { row_type: 'section', item_name: 'DINING ROOM', sort_order: 8 },
    {
      row_type: 'item', sort_order: 9,
      item_name: 'Dining Table',
      description: 'Solid white oak dining table with chamfered legs. Satin lacquer finish.',
      quantity: 1, unit: 'each',
      cost_price: 22000, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '2400 × 1000 × 750 mm', colour_finish: 'White Oak / Satin Lacquer',
      lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 10,
      item_name: 'Dining Chair × 8',
      description: 'Upholstered dining chair in terracotta boucle. Natural oak legs.',
      quantity: 8, unit: 'each',
      cost_price: 3400, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '460 × 540 × 890 mm', colour_finish: 'Terracotta Bouclé / Natural Oak',
      lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 11,
      item_name: 'Pendant Light — Dining',
      description: 'Smoked glass cluster pendant, 3-drop configuration. Dimmable warm white LEDs.',
      quantity: 1, unit: 'set',
      cost_price: 8900, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: '∅ 800 mm, Drop: 600 mm', colour_finish: 'Smoked Glass / Brushed Gold',
      lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 12,
      item_name: 'Sideboard',
      description: 'Walnut veneer sideboard with 4-door push-to-open storage. Satin brass handles.',
      quantity: 1, unit: 'each',
      cost_price: 16800, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '2000 × 450 × 800 mm', colour_finish: 'Walnut / Satin Brass',
      lead_time_weeks: 10,
    },

    // ── MASTER BEDROOM ───────────────────────────────────────────────────────
    { row_type: 'section', item_name: 'MASTER BEDROOM', sort_order: 13 },
    {
      row_type: 'item', sort_order: 14,
      item_name: 'Upholstered Bedhead (King)',
      description: 'Floor-to-ceiling padded bedhead in ivory performance linen. Integrated side wings.',
      quantity: 1, unit: 'each',
      cost_price: 12500, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: '2200 × 100 × 1800 mm', colour_finish: 'Ivory Linen',
      lead_time_weeks: 6,
    },
    {
      row_type: 'item', sort_order: 15,
      item_name: 'Bedside Table × 2',
      description: 'Floating walnut bedside table with single drawer and inset brass handle.',
      quantity: 2, unit: 'each',
      cost_price: 4200, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: '550 × 380 × 500 mm', colour_finish: 'Walnut / Satin Brass',
      lead_time_weeks: 8,
    },
    {
      row_type: 'item', sort_order: 16,
      item_name: 'Bedside Wall Sconce × 2',
      description: 'Articulating arm wall light in aged brass. Dimmable, E14 candle bulb.',
      quantity: 2, unit: 'each',
      cost_price: 2100, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      colour_finish: 'Aged Brass',
      lead_time_weeks: 4,
    },
    {
      row_type: 'item', sort_order: 17,
      item_name: 'Bespoke Built-In Wardrobe',
      description: 'Full-height built-in wardrobe, painted MDF carcass with fluted oak door fronts. Push-to-open. Internal fittings: hanging rails, shelving, drawers.',
      quantity: 1, unit: 'each',
      cost_price: 68000, markup_percentage: mkp(supplierB),
      supplier_id: supplierB?.id ?? null, supplier_name: supplierB?.supplier_name ?? null,
      dimensions: '3800 × 620 × 2400 mm', colour_finish: 'Fluted White Oak / White Carcass',
      lead_time_weeks: 14,
    },
    {
      row_type: 'item', sort_order: 18,
      item_name: 'Linen Roman Blind × 3',
      description: 'Custom Roman blinds in off-white Belgian linen. Motorised.',
      quantity: 3, unit: 'each',
      cost_price: 5600, markup_percentage: mkp(supplierA),
      supplier_id: supplierA?.id ?? null, supplier_name: supplierA?.supplier_name ?? null,
      dimensions: '1800 × 2200 mm (per blind)', colour_finish: 'Off-White Belgian Linen',
      lead_time_weeks: 6,
    },
  ]

  // 8. Insert all line items
  const rows = lineItems.map(item => ({
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

  const { error: liErr } = await supabase.from('line_items').insert(rows)
  if (liErr) throw liErr
  console.log(`Created ${rows.length} line items`)
  console.log(`\n✅ Done. Visit: https://quotinghub.co.za/projects/${projectId}`)
}

main().catch(e => { console.error(e); process.exit(1) })
