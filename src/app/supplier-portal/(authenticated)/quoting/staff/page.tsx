import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { StaffManager } from './StaffManager'
import type { ElecStaff, ElecTimePunch } from '@/lib/elec-types'

export const metadata = { title: 'Staff — QuotingHub' }

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(['quoting', 'starter', 'professional', 'business'].includes(account.plan ?? '') && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  // Server component: renders once per request, so reading the clock here is stable by construction.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: staff }, { data: rawPunches }] = await Promise.all([
    supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .order('created_at'),
    supabaseAdmin
      .from('elec_time_punches')
      .select('*')
      .eq('portal_account_id', account.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false }),
  ])

  // Separately fetch job cards referenced by punches (avoids needing a FK relationship)
  const jobIds = [...new Set((rawPunches ?? []).map(p => p.job_id).filter(Boolean))] as string[]
  const { data: jobCards } = jobIds.length > 0
    ? await supabaseAdmin.from('elec_job_cards').select('id, job_number, title').in('id', jobIds).eq('portal_account_id', account.id)
    : { data: [] }
  const jobMap = Object.fromEntries((jobCards ?? []).map(j => [j.id, j]))

  const punches: ElecTimePunch[] = (rawPunches ?? []).map(p => ({
    ...p,
    job: p.job_id ? (jobMap[p.job_id] ?? null) : null,
  }))

  return (
    <StaffManager
      initialStaff={(staff ?? []) as ElecStaff[]}
      punches={punches}
    />
  )
}
