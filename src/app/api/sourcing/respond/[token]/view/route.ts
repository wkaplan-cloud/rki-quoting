import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/sourcing/respond/[token]/view — stamp viewed_at on first open (public, no auth)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, viewed_at')
    .eq('token', token)
    .maybeSingle()

  if (!recipient) return NextResponse.json({ ok: false })

  // Only stamp once
  if (!recipient.viewed_at) {
    await supabaseAdmin
      .from('sourcing_request_recipients')
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq('id', recipient.id)
  }

  return NextResponse.json({ ok: true })
}
