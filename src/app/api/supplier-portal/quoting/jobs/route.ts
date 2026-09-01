import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'
import {
  JOB_SELECT_FULL,
  JOB_SELECT_FULL_WITH_PHOTOS,
  JOB_SELECT_LEGACY,
  JOB_SELECT_LEGACY_WITH_PHOTOS,
  isMissingJobCardLink,
} from '@/lib/elec-job-select'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end   = searchParams.get('end')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const runQuery = async (select: string) => {
      let query = supabaseAdmin
        .from('elec_jobs')
        .select(select)
        .eq('portal_account_id', account.id)
        .order('start_time')

      if (start) query = query.gte('scheduled_date', start)
      if (end)   query = query.lte('scheduled_date', end)

      return query
    }

    let { data, error } = await runQuery(JOB_SELECT_FULL_WITH_PHOTOS)
    if (isMissingJobCardLink(error)) ({ data, error } = await runQuery(JOB_SELECT_LEGACY_WITH_PHOTOS))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const jobs = ((data ?? []) as unknown as Record<string, unknown>[]).map(({ elec_job_photos, ...j }) => ({
      ...j,
      photo_count: (elec_job_photos as { count: number }[] | null)?.[0]?.count ?? 0,
    }))
    return NextResponse.json(jobs)
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { job_card_id, ...rest } = await req.json() as Record<string, unknown>

    const insert = (row: Record<string, unknown>, select: string) => supabaseAdmin
      .from('elec_jobs')
      .insert({ ...row, portal_account_id: account.id })
      .select(select)
      .single()

    let { data, error } = await insert({ ...rest, job_card_id: job_card_id ?? null }, JOB_SELECT_FULL)
    // Pre-migration: elec_jobs has no job_card_id yet — save the job without the link
    if (isMissingJobCardLink(error)) ({ data, error } = await insert(rest, JOB_SELECT_LEGACY))

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}
