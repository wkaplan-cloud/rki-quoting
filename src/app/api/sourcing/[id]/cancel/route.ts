import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sourcing/[id]/cancel — cancel a request at any non-terminal state
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (['pushed', 'cancelled'].includes(request.status)) {
    return NextResponse.json({ error: 'Request is already in a terminal state' }, { status: 400 })
  }

  await supabase
    .from('sourcing_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
