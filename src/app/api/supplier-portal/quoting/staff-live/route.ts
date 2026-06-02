import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

export interface StaffLiveStatus {
  staffId: string
  isClockedIn: boolean
  clockedInAt: string | null
  latitude: number | null
  longitude: number | null
  currentJobCardTitle: string | null
  currentJobCardId: string | null
  currentProjectName: string | null
  currentProjectId: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      { data: staffList },
      { data: punches },
      { data: jobCards },
      { data: projects },
    ] = await Promise.all([
      supabaseAdmin
        .from('elec_staff')
        .select('id')
        .eq('portal_account_id', account.id)
        .eq('is_active', true),
      supabaseAdmin
        .from('elec_time_punches')
        .select('staff_id, punch_type, punched_at, latitude, longitude')
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
        .select('id, project_name, project_address, staff_id')
        .eq('portal_account_id', account.id)
        .eq('status', 'in_progress')
        .not('staff_id', 'is', null),
    ])

    // Latest punch per staff (punches already ordered DESC)
    const latestPunch = new Map<string, {
      punch_type: string; punched_at: string
      latitude: number | null; longitude: number | null
    }>()
    for (const p of (punches ?? [])) {
      if (!latestPunch.has(p.staff_id)) latestPunch.set(p.staff_id, p)
    }

    const result: StaffLiveStatus[] = (staffList ?? []).map(s => {
      const punch = latestPunch.get(s.id)
      const isClockedIn = punch?.punch_type === 'clock_in'
      const jobCard = (jobCards ?? []).find(j => j.staff_id === s.id)
      const project = (projects ?? []).find(p => p.staff_id === s.id)
      return {
        staffId: s.id,
        isClockedIn,
        clockedInAt: isClockedIn ? (punch?.punched_at ?? null) : null,
        latitude: isClockedIn ? (punch?.latitude ?? null) : null,
        longitude: isClockedIn ? (punch?.longitude ?? null) : null,
        currentJobCardTitle: jobCard?.title ?? null,
        currentJobCardId: jobCard?.id ?? null,
        currentProjectName: project?.project_name ?? null,
        currentProjectId: project?.id ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (e) { return apiError(e) }
}
