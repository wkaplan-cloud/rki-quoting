import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/respond/[token]/session
// Public: supplier saves session-level fields (delivery_fee)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { delivery_fee?: number | null; installation_fee?: number | null }

    const updates: Record<string, unknown> = {}
    if ('delivery_fee' in body) updates.delivery_fee = body.delivery_fee ?? null
    if ('installation_fee' in body) updates.installation_fee = body.installation_fee ?? null

    const { error } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .update(updates)
      .eq('id', ss.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
