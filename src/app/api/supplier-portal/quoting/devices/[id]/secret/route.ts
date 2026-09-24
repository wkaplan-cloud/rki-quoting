import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveAccountOrStaff } from '@/lib/portal-account'
import { decrypt } from '@/lib/sage-crypto'

/** Reveals one device's password, on an explicit click — the only place it is ever decrypted. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const who = await resolveAccountOrStaff(user.id)
    if (!who) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data } = await supabaseAdmin
      .from('elec_devices').select('password_encrypted')
      .eq('id', id).eq('portal_account_id', who.accountId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    if (!data.password_encrypted) return NextResponse.json({ password: null })
    return NextResponse.json({ password: decrypt(data.password_encrypted) })
  } catch (e) {
    return apiError(e)
  }
}
