import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { buildHandoverPack } from '@/lib/handover'
import { activeServicePlan } from '@/lib/service-contracts'

export const maxDuration = 60

/** GET ?credentials=1 includes device logins; ?download=1 saves instead of opening. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const includeCredentials = req.nextUrl.searchParams.get('credentials') === '1'
    const pack = await buildHandoverPack({
      accountId: account.id, quoteId, includeCredentials,
      servicePlan: await activeServicePlan(account.id, quoteId),
    })
    if (!pack) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new NextResponse(new Uint8Array(pack.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${pack.quote.quote_number}-handover.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
