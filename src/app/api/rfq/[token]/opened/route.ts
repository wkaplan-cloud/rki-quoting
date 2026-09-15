import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/rfq/[token]/opened
// Public — no auth. Pinged by the pricing page once it has mounted in the
// supplier's browser, to record that they actually opened their link.
//
// Why a ping from the client and not the server render (or an email pixel):
// mail-security scanners — Microsoft Defender Safe Links, Mimecast, Barracuda —
// fetch link targets automatically to vet them, which would stamp an "open" for
// every protected recipient without a human involved. They do not run
// JavaScript. An effect firing after React mounts is therefore a far better
// proxy for a person than either the server render or a tracking pixel, which
// Apple Mail Privacy Protection pre-fetches on delivery for everyone.
//
// Always answers 200: this is telemetry sitting in front of a page the supplier
// needs to use, so it must never surface an error to them, and it must never
// reveal whether a token is real.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: request } = await supabaseAdmin
      .from('rfq_requests')
      .select('id, opened_at, open_count')
      .eq('token', token)
      .maybeSingle()
    if (!request) return NextResponse.json({ ok: true })

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('rfq_requests')
      .update({
        opened_at: (request.opened_at as string | null) ?? now,
        last_opened_at: now,
        open_count: ((request.open_count as number | null) ?? 0) + 1,
      })
      .eq('id', request.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[rfq opened] stamp failed', e)
    return NextResponse.json({ ok: true })
  }
}
