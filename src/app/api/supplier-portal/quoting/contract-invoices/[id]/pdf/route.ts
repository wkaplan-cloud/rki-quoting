import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { renderContractInvoice } from '@/lib/contract-invoices'

export const maxDuration = 60

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const r = await renderContractInvoice(account.id, id)
    if (!r) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(r.buffer), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${r.invoice.invoice_number}.pdf"` },
    })
  } catch (e) {
    return apiError(e)
  }
}
