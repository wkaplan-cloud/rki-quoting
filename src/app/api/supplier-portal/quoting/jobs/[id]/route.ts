import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json()
    const { data, error } = await supabaseAdmin
      .from('elec_jobs')
      .update(body)
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .select('*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name), elec_job_photos(count)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const { elec_job_photos, ...rest } = data as typeof data & { elec_job_photos: { count: number }[] | null }
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
