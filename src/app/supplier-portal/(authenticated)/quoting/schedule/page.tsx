import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { WeekCalendar } from './WeekCalendar'
import type { ElecJob, ElecStaff } from '@/lib/elec-types'

export const metadata = { title: 'Schedule — QuotingHub' }

function getWeekBounds() {
  const today = new Date()
  const day   = today.getDay()
  const start = new Date(today)
  start.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  }
}

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  const isTrialing = account?.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  if (!account || !(account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const { start, end } = getWeekBounds()

  const [{ data: jobs }, { data: staff }, { data: quotes }] = await Promise.all([
    supabaseAdmin
      .from('elec_jobs')
      .select('*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name)')
      .eq('portal_account_id', account.id)
      .gte('scheduled_date', start)
      .lte('scheduled_date', end)
      .order('start_time'),
    supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .eq('is_active', true)
      .order('created_at'),
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, project_address')
      .eq('portal_account_id', account.id)
      .in('status', ['quoted', 'approved', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div className="flex flex-col h-full">
      <WeekCalendar
        initialJobs={(jobs ?? []) as ElecJob[]}
        staff={(staff ?? []) as ElecStaff[]}
        quotes={(quotes ?? []) as { id: string; quote_number: string; project_name: string; project_address: string | null }[]}
        companyName={account.company_name ?? account.email ?? 'Schedule'}
      />
    </div>
  )
}
