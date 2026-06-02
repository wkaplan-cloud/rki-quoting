import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, share_token, status')
      .eq('id', quoteId)
      .eq('portal_account_id', account.id)
      .single()
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Return existing token if already generated
    if (quote.share_token) {
      return NextResponse.json({ token: quote.share_token })
    }

    // Generate new token
    const token = crypto.randomUUID()
    await supabaseAdmin
      .from('elec_quotes')
      .update({ share_token: token, share_token_created_at: new Date().toISOString() })
      .eq('id', quoteId)

    return NextResponse.json({ token })
  } catch (e) {
    return apiError(e)
  }
}
