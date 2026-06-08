import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { COCListClient } from './COCListClient'
import type { ElecCOC } from '@/lib/elec-types'

export const metadata = { title: 'COC — QuotingHub' }

export default async function COCPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(['quoting', 'starter', 'professional', 'business'].includes(account.plan ?? '') && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const [
    { data: completedProjects },
    { data: completedJobCards },
    { data: existingCOCs },
    { data: settings },
  ] = await Promise.all([
    // All completed projects
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, project_address, client:elec_clients(id, client_name, email)')
      .eq('portal_account_id', account.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(500),

    // All completed job cards
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, location, client_name, client_email')
      .eq('portal_account_id', account.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(500),

    // All existing COCs for this account (by account_id OR quote_id)
    supabaseAdmin
      .from('elec_coc')
      .select('*')
      .eq('portal_account_id', account.id)
      .limit(2000),

    // Settings for COC prefix
    supabaseAdmin
      .from('elec_settings')
      .select('coc_prefix, company_code')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
  ])

  // Also fetch COCs by quote_id for projects that existed before the migration backfill
  const projectIds = (completedProjects ?? []).map(p => p.id)
  let legacyCOCs: ElecCOC[] = []
  if (projectIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('elec_coc')
      .select('*')
      .in('quote_id', projectIds)
      .limit(2000)
    legacyCOCs = (data ?? []) as ElecCOC[]
  }

  // Build a merged COC map: quote_id → COC, job_card_id → COC (deduplicated)
  const cocByQuoteId = new Map<string, ElecCOC>()
  const cocByJobCardId = new Map<string, ElecCOC>()
  for (const coc of [...legacyCOCs, ...(existingCOCs ?? []) as ElecCOC[]]) {
    if (coc.quote_id && !cocByQuoteId.has(coc.quote_id)) cocByQuoteId.set(coc.quote_id, coc)
    if (coc.job_card_id && !cocByJobCardId.has(coc.job_card_id)) cocByJobCardId.set(coc.job_card_id, coc)
  }

  return (
    <COCListClient
      completedProjects={(completedProjects ?? []) as unknown as {
        id: string; quote_number: string; project_name: string; project_address: string | null
        client: { id: string; client_name: string; email: string | null } | null
      }[]}
      completedJobCards={(completedJobCards ?? []) as {
        id: string; job_number: string; title: string; location: string | null
        client_name: string | null; client_email: string | null
      }[]}
      cocByQuoteId={Object.fromEntries(cocByQuoteId) as Record<string, ElecCOC>}
      cocByJobCardId={Object.fromEntries(cocByJobCardId) as Record<string, ElecCOC>}
      cocPrefix={(settings as { coc_prefix?: string } | null)?.coc_prefix ?? 'COC'}
      companyCode={(settings as { company_code?: string } | null)?.company_code ?? ''}
    />
  )
}
