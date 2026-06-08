import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

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

    let query = supabaseAdmin
      .from('elec_jobs')
      .select('*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name), elec_job_photos(count)')
      .eq('portal_account_id', account.id)
      .order('start_time')

    if (start) query = query.gte('scheduled_date', start)
    if (end)   query = query.lte('scheduled_date', end)

    const { data } = await query
    const jobs = (data ?? []).map(({ elec_job_photos, ...j }) => ({
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

    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('elec_jobs')
      .insert({ ...body, portal_account_id: account.id })
      .select('*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}
