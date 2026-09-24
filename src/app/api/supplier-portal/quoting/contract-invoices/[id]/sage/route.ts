import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { pushContractInvoiceToSage } from '@/lib/contract-invoices'

export const maxDuration = 30

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const result = await pushContractInvoiceToSage(account.id, id)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (e) {
    return apiError(e)
  }
}
