import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'
import {
  JOB_SELECT_FULL_WITH_PHOTOS,
  JOB_SELECT_LEGACY_WITH_PHOTOS,
  isMissingJobCardLink,
} from '@/lib/elec-job-select'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { job_card_id, ...body } = await req.json() as Record<string, unknown>

    const update = (row: Record<string, unknown>, select: string) => supabaseAdmin
      .from('elec_jobs')
      .update(row)
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .select(select)
      .single()

    let { data, error } = await update({ ...body, job_card_id: job_card_id ?? null }, JOB_SELECT_FULL_WITH_PHOTOS)
    // Pre-migration: elec_jobs has no job_card_id yet — update without the link
    if (isMissingJobCardLink(error)) ({ data, error } = await update(body, JOB_SELECT_LEGACY_WITH_PHOTOS))

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const { elec_job_photos, ...rest } = data as unknown as Record<string, unknown> & { elec_job_photos: { count: number }[] | null }
    return NextResponse.json({ ...rest, photo_count: elec_job_photos?.[0]?.count ?? 0 })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    await supabaseAdmin
      .from('elec_jobs')
      .delete()
      .eq('id', id)
      .eq('portal_account_id', account.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
