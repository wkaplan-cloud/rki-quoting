import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** One searchable thing in the command palette. */
export interface SearchEntry {
  id: string
  /** Which portal it belongs to — drives the group heading and accent. */
  group: 'Studios' | 'Contractors' | 'Manufacturers' | 'Suppliers' | 'Price lists'
  label: string
  /** Second line: email, plan, owner — whatever tells two similar rows apart. */
  hint: string | null
  href: string
  /** Extra text matched against but not shown. */
  keywords: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: orgs }, { data: accounts }, { data: priceLists }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('organizations')
      .select('id, name, plan, subscription_status, status')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('supplier_portal_accounts')
      .select('id, company_name, contact_name, email, supplier_category, plan, subscription_status')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('price_lists')
      .select('id, name, supplier_name, item_count')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('settings').select('org_id, business_name'),
  ])

  const businessName = new Map((settings ?? []).map(s => [s.org_id, s.business_name]))

  const entries: SearchEntry[] = []

  for (const o of orgs ?? []) {
    const trading = businessName.get(o.id)
    entries.push({
      id: `org-${o.id}`,
      group: 'Studios',
      label: o.name ?? trading ?? 'Unnamed studio',
      hint: [trading && trading !== o.name ? trading : null, o.plan, o.status === 'archived' ? 'archived' : o.subscription_status]
        .filter(Boolean).join(' · ') || null,
      href: `/platform/studios/${o.id}`,
      keywords: [o.name, trading, o.plan, o.subscription_status].filter(Boolean).join(' '),
    })
  }

  for (const a of accounts ?? []) {
    const trades = a.supplier_category === 'trades'
    entries.push({
      id: `acc-${a.id}`,
      group: trades ? 'Contractors' : a.supplier_category === 'manufacturer' ? 'Manufacturers' : 'Suppliers',
      label: a.company_name || a.contact_name || a.email,
      hint: [a.email, a.plan, a.subscription_status].filter(Boolean).join(' · ') || null,
      // Only manufacturers have a detail route; the rest resolve on their list page.
      href: a.supplier_category === 'manufacturer'
        ? `/platform/manufacturing/${a.id}`
        : trades ? '/platform/electricians' : '/platform/suppliers',
      keywords: [a.company_name, a.contact_name, a.email, a.plan].filter(Boolean).join(' '),
    })
  }

  for (const pl of priceLists ?? []) {
    entries.push({
      id: `pl-${pl.id}`,
      group: 'Price lists',
      label: pl.name ?? 'Untitled price list',
      hint: [pl.supplier_name, pl.item_count ? `${pl.item_count} items` : null].filter(Boolean).join(' · ') || null,
      href: `/platform/price-lists/${pl.id}`,
      keywords: [pl.name, pl.supplier_name].filter(Boolean).join(' '),
    })
  }

  return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } })
}
