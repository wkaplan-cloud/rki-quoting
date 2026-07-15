export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { todaySA } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffHome } from './StaffHome'
import type { ElecTimePunch, ElecJobCard, ElecClient, ElecJob } from '@/lib/elec-types'

export default async function StaffHomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: initialTab } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('id, name, role, color, portal_account_id, is_active')
    .eq('auth_user_id', user.id)
    .single()

  if (!staff || !staff.is_active) redirect('/supplier-portal/not-a-supplier')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('company_name')
    .eq('id', staff.portal_account_id)
    .single()

  // Last 30 days punches + assigned job cards + clients + today's scheduled jobs
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const todayStr = todaySA()
  const [{ data: punches }, { data: jobCards }, { data: clients }, { data: projects }, { data: scheduledToday }] = await Promise.all([
    supabaseAdmin
      .from('elec_time_punches')
      .select('*')
      .eq('staff_id', staff.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false }),
    supabaseAdmin
      .from('elec_job_cards')
      .select(`*, client:elec_clients(id,client_name,email)`)
      .eq('portal_account_id', staff.portal_account_id)
      .or(`staff_id.eq.${staff.id},additional_staff_ids.cs.{${staff.id}}`)
      .in('status', ['pending', 'in_progress'])
      .order('scheduled_at', { ascending: true }),
    supabaseAdmin
      .from('elec_clients')
      .select('id, client_name, company, email')
      .eq('portal_account_id', staff.portal_account_id)
      .order('client_name', { ascending: true }),
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, project_address, status, client:elec_clients(id, client_name)')
      .eq('portal_account_id', staff.portal_account_id)
      .or(`staff_id.eq.${staff.id},additional_staff_ids.cs.{${staff.id}}`)
      .in('status', ['approved', 'in_progress'])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_jobs')
      .select('id, title, start_time, end_time, address, status, quote_id')
      .eq('portal_account_id', staff.portal_account_id)
      .eq('staff_id', staff.id)
      .eq('scheduled_date', todayStr)
      .in('status', ['scheduled', 'in_progress'])
      .is('quote_id', null)   // only standalone jobs — project/job-card linked ones already appear in their tabs
      .order('start_time'),
  ])

  const lastGlobalPunch = (punches ?? []).find(p => !p.job_id) ?? null
  const isClockedIn = lastGlobalPunch?.punch_type === 'clock_in'

  return (
    <StaffHome
      staff={staff}
      companyName={account?.company_name ?? ''}
      portalAccountId={staff.portal_account_id}
      initialPunches={(punches ?? []) as ElecTimePunch[]}
      isClockedIn={isClockedIn}
      assignedJobCards={(jobCards ?? []) as ElecJobCard[]}
      initialClients={(clients ?? []) as Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email'>[]}
      assignedProjects={(projects ?? []) as unknown as { id: string; quote_number: string; project_name: string; project_address: string | null; status: string; client: { id: string; client_name: string } | null }[]}
      scheduledToday={(scheduledToday ?? []) as ElecJob[]}
      initialTab={(initialTab as 'home' | 'jobs' | 'projects' | 'history' | 'inspect') ?? 'home'}
    />
  )
}
