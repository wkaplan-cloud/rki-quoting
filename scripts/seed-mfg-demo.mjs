#!/usr/bin/env node
/**
 * Seed a demo manufacturing portal account for testing.
 *
 * Usage:
 *   node scripts/seed-mfg-demo.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const EMAIL    = 'demo-mfg@quotinghub.co.za'
const PASSWORD = 'DemoManufacturer2025!'

async function run() {
  console.log('Creating demo manufacturing account...')

  // 1. Create auth user (or get existing)
  let userId
  const { data: existing } = await sb.auth.admin.listUsers()
  const existingUser = existing?.users?.find(u => u.email === EMAIL)

  if (existingUser) {
    userId = existingUser.id
    console.log(`  → Using existing auth user: ${userId}`)
  } else {
    const { data: newUser, error } = await sb.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    })
    if (error) { console.error('Auth error:', error.message); process.exit(1) }
    userId = newUser.user.id
    console.log(`  → Created auth user: ${userId}`)
  }

  // 2. Upsert supplier_portal_accounts
  const { data: account, error: accErr } = await sb
    .from('supplier_portal_accounts')
    .upsert({
      auth_user_id:         userId,
      email:                EMAIL,
      company_name:         'Craft Woodworks (Demo)',
      plan:                 'quoting',
      plan_category:        'manufacturer',
      subscription_status:  'active',
    }, { onConflict: 'auth_user_id' })
    .select('id')
    .single()

  if (accErr) { console.error('Portal account error:', accErr.message); process.exit(1) }
  const portalId = account.id
  console.log(`  → Portal account: ${portalId}`)

  // 3. Settings
  await sb.from('mfg_settings').upsert({
    portal_account_id:          portalId,
    business_name:              'Craft Woodworks (Pty) Ltd',
    address:                    '14 Mill Street, Woodstock, Cape Town',
    email:                      'info@craftwoodworks.co.za',
    phone:                      '021 555 0123',
    company_registration_number:'2019/123456/07',
    vat_registered:             true,
    vat_registration_number:    '4560123456',
    default_vat_rate:           15,
    bank_name:                  'First National Bank',
    bank_account_holder:        'Craft Woodworks (Pty) Ltd',
    bank_account_number:        '62 8374 9201',
    bank_branch_code:           '250 655',
    bank_account_type:          'cheque',
    default_markup_percentage:  35,
    quote_validity_days:        30,
    default_deposit_percentage: 50,
    default_payment_terms:      '50% deposit on acceptance of quotation. Balance payable on completion before delivery.',
    quote_prefix:               'QUO',
    invoice_prefix:             'INV',
    quote_number_seed:          10,
    invoice_number_seed:        5,
    accent_color:               '#1B4F8A',
    terms_and_conditions:       '1. Payment: 50% deposit on acceptance, balance on completion.\n2. Quote validity: 30 days from date of issue.\n3. Lead time: As per agreed schedule; subject to deposit receipt.\n4. Cancellation: Deposit is non-refundable after production commences.\n5. Variations: Any changes to scope after acceptance are subject to a variation order.\n6. Delivery: Delivery and installation costs excluded unless otherwise stated.',
  }, { onConflict: 'portal_account_id' })
  console.log('  → Settings seeded')

  // 4. Price book
  const materials = [
    { item_type: 'material', category: 'boards',        name: 'Veneer Board — American Walnut 18mm', unit: 'sheet', cost_price: 480, apply_markup_default: true  },
    { item_type: 'material', category: 'boards',        name: 'Veneer Board — Oak 18mm',             unit: 'sheet', cost_price: 420, apply_markup_default: true  },
    { item_type: 'material', category: 'boards',        name: 'MDF Board 16mm',                      unit: 'sheet', cost_price: 185, apply_markup_default: true  },
    { item_type: 'material', category: 'boards',        name: 'Plywood 18mm',                        unit: 'sheet', cost_price: 290, apply_markup_default: true  },
    { item_type: 'material', category: 'solid_timber',  name: 'Solid Walnut Plank 25mm',             unit: 'plank', cost_price: 320, apply_markup_default: true  },
    { item_type: 'material', category: 'solid_timber',  name: 'Solid Oak Plank 25mm',                unit: 'plank', cost_price: 280, apply_markup_default: true  },
    { item_type: 'material', category: 'acrylic_specialty', name: 'Acrylic Board 10mm Clear',        unit: 'sheet', cost_price: null, supplier_quoted: true, apply_markup_default: true },
    { item_type: 'hardware', category: 'hinges_rails',  name: 'Soft-close Hinge',                    unit: 'piece', cost_price: 45,  apply_markup_default: true  },
    { item_type: 'hardware', category: 'hinges_rails',  name: 'Drawer Rail 450mm',                   unit: 'piece', cost_price: 85,  apply_markup_default: true  },
    { item_type: 'hardware', category: 'glass_mirrors', name: 'Glass Panel 6mm Clear',               unit: 'piece', cost_price: 900, apply_markup_default: false },
    { item_type: 'hardware', category: 'glass_mirrors', name: 'Mirror Panel 4mm',                    unit: 'piece', cost_price: 750, apply_markup_default: false },
    { item_type: 'hardware', category: 'finishes_oils', name: 'Jax Wax — Natural',                   unit: 'litre', cost_price: 220, apply_markup_default: true  },
    { item_type: 'hardware', category: 'lighting',      name: 'LED Strip 3m Warm White',             unit: 'piece', cost_price: 255, apply_markup_default: true  },
    { item_type: 'hardware', category: 'handles_fittings', name: 'Brushed Brass Handle',             unit: 'piece', cost_price: 95,  apply_markup_default: true  },
  ]
  for (const m of materials) {
    await sb.from('mfg_price_book_items').upsert(
      { portal_account_id: portalId, supplier_quoted: false, ...m },
      { onConflict: 'id' }
    )
  }
  console.log(`  → ${materials.length} price book items seeded`)

  // 5. Clients
  const clients = [
    { client_type: 'company',    client_name: 'Smith Homes (Pty) Ltd', contact_person: 'John Smith', email: 'john@smithhomes.co.za', phone: '082 555 0123', address: '14 Oak Avenue, Constantia, Cape Town' },
    { client_type: 'individual', client_name: 'Priya Patel',           email: 'priya@gmail.com',     phone: '083 444 0987', address: '5 Garden Road, Newlands, Cape Town' },
    { client_type: 'company',    client_name: 'Dlamini Interiors',     contact_person: 'Thabo Dlamini', email: 'thabo@dlaminiinteriors.co.za', phone: '011 234 5678', address: '22 Commerce Street, Johannesburg' },
  ]
  const clientIds = []
  for (const c of clients) {
    const { data } = await sb.from('mfg_clients').upsert(
      { portal_account_id: portalId, ...c },
      { onConflict: 'id' }
    ).select('id').single()
    clientIds.push(data?.id)
  }
  console.log(`  → ${clients.length} clients seeded`)

  // 6. A sample job + quote for first client
  const { data: job } = await sb.from('mfg_jobs').insert({
    portal_account_id: portalId,
    client_id:  clientIds[0],
    job_name:   'Master Bedroom Built-in Cupboards',
  }).select('id').single()

  const { data: quote } = await sb.from('mfg_quotes').insert({
    portal_account_id: portalId,
    job_id:            job.id,
    quote_number:      'QUO-010',
    revision_number:   1,
    status:            'sent',
    apply_vat:         true,
    vat_rate:          15,
    valid_until:       new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
    sent_at:           new Date(Date.now() - 5 * 86400000).toISOString(),
    sent_to_email:     'john@smithhomes.co.za',
    subtotal:          22151,
    vat_amount:        3322.65,
    total:             25473.65,
    total_cost:        14415,
    total_profit:      7736,
  }).select('id').single()

  // Line items
  const { data: li1 } = await sb.from('mfg_quote_line_items').insert({
    quote_id: quote.id, sort_order: 0,
    description:       'Floor-to-ceiling wardrobe unit in American walnut veneer with soft-close hinges and integrated LED lighting. Custom 2.4m height unit, 4 doors.',
    callout_note:      'Client to confirm exact ceiling height and wall position before production commences.',
    quantity:          3,
    unit_price:        5117,
    line_total:        15351,
    markup_percentage: 35,
    cost_per_unit:     3405,
    profit_per_unit:   1712,
    margin_percentage: 33.5,
  }).select('id').single()

  const { data: li2 } = await sb.from('mfg_quote_line_items').insert({
    quote_id: quote.id, sort_order: 1,
    description: 'Open shelving unit with toughened glass panels. 3-bay, 25mm glass, matt black brackets.',
    quantity: 1,
    unit_price: 6800,
    line_total: 6800,
    markup_percentage: 35,
    cost_per_unit: 4200,
    profit_per_unit: 2600,
    margin_percentage: 38.2,
  }).select('id').single()

  // Cost materials for li1
  await sb.from('mfg_cost_materials').insert([
    { line_item_id: li1.id, item_name: 'Veneer Board — American Walnut 18mm', unit: 'sheet', quantity: 3, unit_cost: 480, sort_order: 0 },
    { line_item_id: li1.id, item_name: 'Solid Walnut Plank 25mm',             unit: 'plank', quantity: 2, unit_cost: 320, sort_order: 1 },
  ])
  await sb.from('mfg_cost_hardware').insert([
    { line_item_id: li1.id, item_name: 'Soft-close Hinge',       unit: 'piece', quantity: 6, unit_cost: 45,  apply_markup: true,  sort_order: 0 },
    { line_item_id: li1.id, item_name: 'LED Strip 3m Warm White', unit: 'piece', quantity: 1, unit_cost: 255, apply_markup: true,  sort_order: 1 },
  ])
  await sb.from('mfg_cost_materials').insert([
    { line_item_id: li2.id, item_name: 'MDF Board 16mm', unit: 'sheet', quantity: 2, unit_cost: 185, sort_order: 0 },
  ])
  await sb.from('mfg_cost_hardware').insert([
    { line_item_id: li2.id, item_name: 'Glass Panel 6mm Clear', unit: 'piece', quantity: 3, unit_cost: 900, apply_markup: false, sort_order: 0 },
  ])

  // 7. Activity log
  await sb.from('mfg_activity_log').insert([
    { portal_account_id: portalId, entity_type: 'quote', entity_id: quote.id, action: 'created',      actor_name: 'Demo User' },
    { portal_account_id: portalId, entity_type: 'quote', entity_id: quote.id, action: 'sent',         actor_name: 'Demo User', metadata: { email: 'john@smithhomes.co.za' } },
  ])

  console.log(`  → Sample job + quote (QUO-010) seeded`)

  console.log('\n✅ Demo account created!')
  console.log(`   Email:    ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log(`   Login at: /supplier-portal/login`)
}

run().catch(e => { console.error(e); process.exit(1) })
