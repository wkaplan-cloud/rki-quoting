import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { sendContractInvoice } from '@/lib/contract-invoices'

export const maxDuration = 60

/** POST { email? } — emails the invoice PDF; defaults to the client's address. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { email } = await req.json().catch(() => ({})) as { email?: string }
    const result = await sendContractInvoice(account.id, id, email)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
