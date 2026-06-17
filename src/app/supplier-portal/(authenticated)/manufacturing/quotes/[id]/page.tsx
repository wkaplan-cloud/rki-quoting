export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgQuoteBuilder } from './MfgQuoteBuilder'
import type { MfgPriceBookItem, MfgSettings, MfgLineItemTemplateFull } from '@/lib/mfg-types'

export default async function MfgQuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')
  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  // Round 1 — all queries that only need `id` or `account.id` run in parallel
  const [
    { data: quote },
    { data: priceBook },
    { data: settings },
    { data: templates },
    { data: lineItems },
  ] = await Promise.all([
    supabase
      .from('mfg_quotes')
      .select(`*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, client_type, contact_person, email, phone, address, vat_number))`)
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .single(),
    supabase
      .from('mfg_price_book_items')
      .select('*')
      .eq('portal_account_id', account.id)
      .is('archived_at', null)
      .order('item_type').order('category').order('name'),
    supabase
      .from('mfg_settings')
      .select('*')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
    supabase
      .from('mfg_line_item_templates')
      .select('*, materials:mfg_template_materials(*), hardware:mfg_template_hardware(*)')
      .eq('portal_account_id', account.id)
      .order('template_name'),
    supabase
      .from('mfg_quote_line_items')
      .select('*')
      .eq('quote_id', id)
      .order('sort_order'),
  ])

  if (!quote) notFound()

  // Round 2 — needs lineItem IDs (from round 1) and quote_number (from round 1)
  const liIds = (lineItems ?? []).map(li => li.id)
  const [{ data: materials }, { data: hardware }, { data: revisions }] = await Promise.all([
    liIds.length ? supabase.from('mfg_cost_materials').select('*').in('line_item_id', liIds).order('sort_order') : { data: [] },
    liIds.length ? supabase.from('mfg_cost_hardware').select('*').in('line_item_id', liIds).order('sort_order') : { data: [] },
    supabase
      .from('mfg_quotes')
      .select('id, revision_number, status, created_at')
      .eq('portal_account_id', account.id)
      .eq('quote_number', quote.quote_number)
      .order('revision_number'),
  ])

  const lineItemsFull = (lineItems ?? []).map(li => ({
    ...li,
    components: [
      ...(materials ?? []).filter(m => m.line_item_id === li.id).map(m => ({ ...m, _type: 'material' as const })),
      ...(hardware ?? []).filter(h => h.line_item_id === li.id).map(h => ({ ...h, _type: 'hardware' as const })),
    ].sort((a, b) => a.sort_order - b.sort_order),
    cost_builder_open: false,
  }))

  return (
    <MfgQuoteBuilder
      quote={quote}
      initialLineItems={lineItemsFull}
      priceBook={(priceBook ?? []) as MfgPriceBookItem[]}
      settings={settings as MfgSettings | null}
      templates={(templates ?? []) as MfgLineItemTemplateFull[]}
      revisions={revisions ?? []}
    />
  )
}
