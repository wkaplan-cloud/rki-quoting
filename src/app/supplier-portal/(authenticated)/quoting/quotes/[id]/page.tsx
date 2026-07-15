export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { QuoteEditor } from './QuoteEditor'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecVariationOrder, ElecSnagItem, ElecCOC, ElecClaim, ElecClaimLineItem, ElecStaff } from '@/lib/elec-types'

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

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
    { data: staff },
  ] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('*, client:elec_clients(id, client_name, company, email, vat_number, qs_name, qs_email)')
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
      .select('id, client_name, company, email, address, vat_number, qs_name, qs_email')
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
      .select('company_code, vo_prefix, coc_prefix, claim_prefix, sage_company_id, quote_send_bcc_admins')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
    supabaseAdmin
      .from('elec_staff')
      .select('id, name, color, role')
      .eq('portal_account_id', account.id)
      .eq('is_active', true)
      .order('name'),
  ])

  const autoCode = (account.company_name ?? '').split(/\s+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 5)
  const companyCode = (settings?.company_code ?? '').trim() || autoCode

  if (!quote) notFound()

  return (
    <QuoteEditor
      portalAccountId={account.id}
      quote={quote as ElecQuote & { client: ElecClient | null }}
      sections={(sections ?? []) as ElecQuoteSection[]}
      items={(items ?? []) as ElecQuoteLineItem[]}
      clients={(clients ?? []) as Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'address' | 'qs_name' | 'qs_email'>[]}
      variations={(variations ?? []) as ElecVariationOrder[]}
      snags={(snags ?? []) as ElecSnagItem[]}
      coc={(coc ?? null) as ElecCOC | null}
      claims={(claims ?? []) as (ElecClaim & { line_items: ElecClaimLineItem[] })[]}
      staff={(staff ?? []) as Pick<ElecStaff, 'id' | 'name' | 'color' | 'role'>[]}
      voPrefix={settings?.vo_prefix ?? 'VO'}
      companyCode={companyCode}
      sageConnected={!!(settings?.sage_company_id)}
    />
  )
}
