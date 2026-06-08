import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: claimId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: claim } = await supabaseAdmin
      .from('elec_claims')
      .select('id, share_token')
      .eq('id', claimId)
      .eq('portal_account_id', account.id)
      .single()
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    let token = claim.share_token as string | null
    if (!token) {
      token = crypto.randomUUID()
      await supabaseAdmin
        .from('elec_claims')
        .update({ share_token: token, share_token_created_at: new Date().toISOString() })
        .eq('id', claimId)
    }

    return NextResponse.json({ token })
  } catch (e) {
    return apiError(e)
  }
}
