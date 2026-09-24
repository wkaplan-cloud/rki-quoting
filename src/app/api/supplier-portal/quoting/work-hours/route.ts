import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { sumWorkHours, type WorkPunch } from '@/lib/work-hours'

/**
 * GET ?job_card_id=…  hours clocked on one job card
 * GET ?quote_id=…     hours clocked on every job card of a project
 * Split into install and programming time, with each person's share.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const jobCardId = req.nextUrl.searchParams.get('job_card_id')
    const quoteId = req.nextUrl.searchParams.get('quote_id')

    let jobIds: string[] = []
    if (jobCardId) {
      jobIds = [jobCardId]
    } else if (quoteId) {
      const { data: cards } = await supabaseAdmin
        .from('elec_job_cards').select('id').eq('quote_id', quoteId).eq('portal_account_id', account.id)
      jobIds = (cards ?? []).map(c => c.id as string)
    } else {
      return NextResponse.json({ error: 'job_card_id or quote_id required' }, { status: 400 })
    }
    if (jobIds.length === 0) return NextResponse.json({ install: 0, programming: 0, staff: [], jobCards: 0 })

    const { rows: punches, error } = await fetchAllRows<WorkPunch>((from, to) => supabaseAdmin
      .from('elec_time_punches')
      .select('staff_id, job_id, punch_type, punched_at, work_type')
      .eq('portal_account_id', account.id)
      .in('job_id', jobIds)
      .order('punched_at')
      .order('id')
      .range(from, to))
    if (error) return NextResponse.json({ error }, { status: 500 })

    const hours = sumWorkHours(punches)
    const staffIds = Object.keys(hours.byStaff)
    const { data: staff } = staffIds.length
      ? await supabaseAdmin.from('elec_staff').select('id, name').in('id', staffIds).eq('portal_account_id', account.id)
      : { data: [] }
    const names = new Map((staff ?? []).map(s => [s.id as string, s.name as string]))

    return NextResponse.json({
      install: hours.install,
      programming: hours.programming,
      jobCards: jobIds.length,
      staff: staffIds
        .map(id => ({ id, name: names.get(id) ?? 'Former staff', ...hours.byStaff[id] }))
        .sort((a, b) => (b.install + b.programming) - (a.install + a.programming)),
    })
  } catch (e) {
    return apiError(e)
  }
}
