export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { QuoteEditor } from './QuoteEditor'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecVariationOrder, ElecSnagItem, ElecCOC, ElecClaim, ElecClaimLineItem } from '@/lib/elec-types'

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name')
    .eq('auth_user_id', user.id)
    .single()
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const companyCode = (account.company_name ?? '').split(/\s+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)

  const [
    { data: quote },
    { data: sections },
    { data: items },
    { data: clients },
    { data: variations },
    { data: snags },
    { data: coc },
    { data: claims },
    { data: settings },
  ] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('*, client:elec_clients(id, client_name, company, email, qs_name, qs_email)')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .single(),
    supabaseAdmin
      .from('elec_quote_sections')
      .select('*')
      .eq('quote_id', id)
      .order('sort_order'),
    supabaseAdmin
      .from('elec_quote_line_items')
      .select('*')
      .eq('quote_id', id)
      .order('sort_order'),
    supabaseAdmin
      .from('elec_clients')
      .select('id, client_name, company, email, qs_name, qs_email')
      .eq('portal_account_id', account.id)
      .order('client_name'),
    supabaseAdmin
      .from('elec_variation_orders')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_snag_items')
      .select('*')
      .eq('quote_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_coc')
      .select('*')
      .eq('quote_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('elec_claims')
      .select('*, line_items:elec_claim_line_items(*)')
      .eq('quote_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_settings')
      .select('vo_prefix, coc_prefix, claim_prefix')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
  ])

  if (!quote) notFound()

  return (
    <QuoteEditor
      portalAccountId={account.id}
      quote={quote as ElecQuote & { client: ElecClient | null }}
      sections={(sections ?? []) as ElecQuoteSection[]}
      items={(items ?? []) as ElecQuoteLineItem[]}
      clients={(clients ?? []) as Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'qs_name' | 'qs_email'>[]}
      variations={(variations ?? []) as ElecVariationOrder[]}
      snags={(snags ?? []) as ElecSnagItem[]}
      coc={(coc ?? null) as ElecCOC | null}
      claims={(claims ?? []) as (ElecClaim & { line_items: ElecClaimLineItem[] })[]}
      voPrefix={settings?.vo_prefix ?? 'VO'}
      cocPrefix={settings?.coc_prefix ?? 'COC'}
      companyCode={companyCode}
    />
  )
}
