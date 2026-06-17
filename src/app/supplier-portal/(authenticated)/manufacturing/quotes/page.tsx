export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgQuotesListClient } from './MfgQuotesListClient'

export default async function MfgQuotesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams
  const showArchived = archived === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')
  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  let quotesQuery = supabase
    .from('mfg_quotes')
    .select('*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name))')
    .eq('portal_account_id', account.id)
    .order('created_at', { ascending: false })

  if (showArchived) {
    quotesQuery = quotesQuery.not('archived_at', 'is', null)
  } else {
    quotesQuery = quotesQuery.is('archived_at', null).neq('status', 'superseded')
  }

  const [{ data: quotes }, { data: clients }, { data: settings }] = await Promise.all([
    quotesQuery,
    supabase
      .from('mfg_clients')
      .select('id, client_name, contact_person')
      .eq('portal_account_id', account.id)
      .is('archived_at', null)
      .order('client_name'),
    supabase
      .from('mfg_settings')
      .select('default_markup_percentage, default_vat_rate, quote_validity_days')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Quotes</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Create, send and manage your quotations.</p>
      </div>
      <MfgQuotesListClient
        key={showArchived ? 'archived' : 'active'}
        initialQuotes={quotes ?? []}
        clients={clients ?? []}
        defaultMarkup={settings?.default_markup_percentage ?? 30}
        showArchived={showArchived}
      />
    </div>
  )
}
