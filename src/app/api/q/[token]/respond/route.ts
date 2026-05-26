import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await req.json() as { action: 'approve' | 'request_changes'; client_name?: string; notes?: string }

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, status, portal_account_id')
      .eq('share_token', token)
      .single()

    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['quoted', 'draft'].includes(quote.status)) {
      return NextResponse.json({ error: 'Quote is not in a state that can be approved' }, { status: 409 })
    }

    if (body.action === 'approve') {
      await supabaseAdmin
        .from('elec_quotes')
        .update({ status: 'approved', approved_date: new Date().toISOString().split('T')[0] })
        .eq('id', quote.id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
