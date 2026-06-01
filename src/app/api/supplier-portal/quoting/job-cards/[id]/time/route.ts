import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: punches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('id, staff_id, punch_type, punched_at, staff:elec_staff(id, name, color)')
      .eq('portal_account_id', account.id)
      .eq('job_id', id)
      .order('punched_at')

    return NextResponse.json(punches ?? [])
  } catch (e) {
    return apiError(e)
  }
}
