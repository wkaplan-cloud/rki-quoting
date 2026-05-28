export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffHome } from './StaffHome'
import type { ElecTimePunch, ElecJobCard } from '@/lib/elec-types'

export default async function StaffHomePage() {
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

  // Last 30 days punches + assigned job cards
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: punches }, { data: jobCards }] = await Promise.all([
    supabaseAdmin
      .from('elec_time_punches')
      .select('*')
      .eq('staff_id', staff.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false }),
    supabaseAdmin
      .from('elec_job_cards')
      .select(`*, client:elec_clients(id,client_name,email)`)
      .eq('staff_id', staff.id)
      .eq('portal_account_id', staff.portal_account_id)
      .in('status', ['pending', 'in_progress'])
      .order('scheduled_at', { ascending: true }),
  ])

  const lastPunch = (punches ?? [])[0] ?? null
  const isClockedIn = lastPunch?.punch_type === 'clock_in'

  return (
    <StaffHome
      staff={staff}
      companyName={account?.company_name ?? ''}
      initialPunches={(punches ?? []) as ElecTimePunch[]}
      isClockedIn={isClockedIn}
      assignedJobCards={(jobCards ?? []) as ElecJobCard[]}
    />
  )
}
