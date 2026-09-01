import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { WeekCalendar } from './WeekCalendar'
import type { ElecJob, ElecStaff, ElecJobCard } from '@/lib/elec-types'
import type { StaffLiveStatus } from '@/app/api/supplier-portal/quoting/staff-live/route'
import { JOB_SELECT_FULL, JOB_SELECT_LEGACY, isMissingJobCardLink } from '@/lib/elec-job-select'

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
  if (!account || !(['quoting', 'starter', 'professional', 'business'].includes(account.plan ?? '') && (account.subscription_status === 'active' || isTrialing))) {
    redirect('/supplier-portal/upgrade')
  }

  const { start, end } = getWeekBounds()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  // job_card is only embeddable once add_job_card_to_elec_jobs.sql has been run
  const fetchJobs = async (select: string) => supabaseAdmin
    .from('elec_jobs')
    .select(select)
    .eq('portal_account_id', account.id)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('start_time')

  const [{ data: jobs }, { data: staff }, { data: quotes }, { data: punches }, { data: jobCardsForLive }, { data: projects }, { data: schedulableJobCards }, { data: scheduledRows }] = await Promise.all([
    fetchJobs(JOB_SELECT_FULL).then(res => isMissingJobCardLink(res.error) ? fetchJobs(JOB_SELECT_LEGACY) : res),
    supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .eq('is_active', true)
      .order('created_at'),
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, project_address, staff_id, additional_staff_ids')
      .eq('portal_account_id', account.id)
      .in('status', ['draft', 'quoted', 'approved', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('elec_time_punches')
      .select('staff_id, punch_type, punched_at, latitude, longitude, job_id')
      .eq('portal_account_id', account.id)
      .gte('punched_at', todayStart.toISOString())
      .order('punched_at', { ascending: false }),
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, title, location, staff_id')
      .eq('portal_account_id', account.id)
      .eq('status', 'in_progress')
      .not('staff_id', 'is', null),
    supabaseAdmin
      .from('elec_quotes')
      .select('id, project_name, staff_id')
      .eq('portal_account_id', account.id)
      .eq('status', 'in_progress')
      .not('staff_id', 'is', null),
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, location, staff_id, status, scheduled_at')
      .eq('portal_account_id', account.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(100),
    // Every job card that already has a slot on the schedule, at any date —
    // used to work out which cards are still waiting for one. Scoped to the
    // account rather than the visible week, so a card scheduled months out
    // isn't mistaken for unscheduled.
    supabaseAdmin
      .from('elec_jobs')
      .select('job_card_id')
      .eq('portal_account_id', account.id)
      .not('job_card_id', 'is', null),
  ])

  // Build initial live statuses server-side.
  // Job-card punches are excluded — they track time against a specific job,
  // not overall attendance. Must match /api/supplier-portal/quoting/staff-live.
  const latestPunch = new Map<string, { punch_type: string; punched_at: string; latitude: number | null; longitude: number | null }>()
  for (const p of (punches ?? [])) {
    if (p.job_id) continue
    if (!latestPunch.has(p.staff_id)) latestPunch.set(p.staff_id, p)
  }
  const initialLiveStatuses: StaffLiveStatus[] = (staff ?? []).map(s => {
    const punch = latestPunch.get(s.id)
    const isClockedIn = punch?.punch_type === 'clock_in'
    const jobCard = (jobCardsForLive ?? []).find(j => j.staff_id === s.id)
    const project = (projects ?? []).find(p => p.staff_id === s.id)
    return {
      staffId: s.id,
      isClockedIn,
      clockedInAt: isClockedIn ? (punch?.punched_at ?? null) : null,
      latitude: isClockedIn ? (punch?.latitude ?? null) : null,
      longitude: isClockedIn ? (punch?.longitude ?? null) : null,
      currentJobCardTitle: jobCard?.title ?? null,
      currentJobCardId: jobCard?.id ?? null,
      currentProjectName: (project as { project_name: string } | undefined)?.project_name ?? null,
      currentProjectId: project?.id ?? null,
    }
  })

  return (
    <div>
      <WeekCalendar
        initialJobs={(jobs ?? []) as unknown as ElecJob[]}
        staff={(staff ?? []) as ElecStaff[]}
        quotes={(quotes ?? []) as { id: string; quote_number: string; project_name: string; project_address: string | null; staff_id: string | null; additional_staff_ids: string[] | null }[]}
        jobCards={(schedulableJobCards ?? []) as { id: string; job_number: string; title: string; location: string | null; staff_id: string | null; scheduled_at: string | null }[]}
        scheduledJobCardIds={(scheduledRows ?? []).map(r => r.job_card_id as string).filter(Boolean)}
        companyName={account.company_name ?? account.email ?? 'Schedule'}
        initialLiveStatuses={initialLiveStatuses}
      />
    </div>
  )
}
