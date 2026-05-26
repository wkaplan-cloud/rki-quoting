export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { QuotesList } from './QuotesList'
import type { ElecQuote, ElecClient } from '@/lib/elec-types'

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const [{ data: quotes }, { data: clients }] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('*, client:elec_clients(id, client_name, company)')
      .eq('portal_account_id', account.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_clients')
      .select('id, client_name, company')
      .eq('portal_account_id', account.id)
      .order('client_name'),
  ])

  return (
    <QuotesList
      portalAccountId={account.id}
      initialQuotes={(quotes ?? []) as (ElecQuote & { client: ElecClient | null })[]}
      clients={(clients ?? []) as Pick<ElecClient, 'id' | 'client_name' | 'company'>[]}
    />
  )
}
