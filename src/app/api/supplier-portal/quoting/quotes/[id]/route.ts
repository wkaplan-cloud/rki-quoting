import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    // Verify ownership
    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id')
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .maybeSingle()

    if (!quote) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    await supabaseAdmin.from('elec_quotes').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
