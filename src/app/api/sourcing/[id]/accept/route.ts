import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sourcing/[id]/accept — designer accepts a specific response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { response_id } = await req.json() as { response_id: string }
  if (!response_id) return NextResponse.json({ error: 'response_id required' }, { status: 400 })

  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['sent', 'responded'].includes(request.status)) {
    return NextResponse.json({ error: 'Request must be in sent or responded state to accept' }, { status: 400 })
  }

  // Verify the response belongs to this request
  const { data: response } = await supabase
    .from('sourcing_request_responses')
    .select('id, recipient_id')
    .eq('id', response_id)
    .single()

  if (!response) return NextResponse.json({ error: 'Response not found' }, { status: 404 })

  const { data: recipient } = await supabase
    .from('sourcing_request_recipients')
    .select('id, sourcing_request_id')
    .eq('id', response.recipient_id)
    .single()

  if (!recipient || recipient.sourcing_request_id !== id) {
    return NextResponse.json({ error: 'Response does not belong to this request' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Update request
  await supabase
    .from('sourcing_requests')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_response_id: response_id,
    })
    .eq('id', id)

  // Mark winning recipient as accepted, all others with responses as rejected
  const { data: allRecipients } = await supabase
    .from('sourcing_request_recipients')
    .select('id, status')
    .eq('sourcing_request_id', id)

  for (const r of allRecipients ?? []) {
    if (r.id === recipient.id) {
      await supabase
        .from('sourcing_request_recipients')
        .update({ status: 'accepted' })
        .eq('id', r.id)
    } else if (r.status === 'responded') {
      await supabase
        .from('sourcing_request_recipients')
        .update({ status: 'rejected' })
        .eq('id', r.id)
    }
  }

  return NextResponse.json({ success: true })
}
