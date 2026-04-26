import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/items/[itemId]/accept
// Body: { assignment_id } — accept a specific supplier's response for this item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignment_id } = await req.json() as { assignment_id: string }
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })

    const now = new Date().toISOString()

    // Mark the winning assignment as accepted, all others as declined
    const { data: assignments } = await supabase
      .from('sourcing_item_assignments')
      .select('id')
      .eq('item_id', itemId)

    if (!assignments?.length) return NextResponse.json({ error: 'No assignments found' }, { status: 404 })

    await Promise.all([
      supabase.from('sourcing_item_assignments')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', assignment_id),
      supabase.from('sourcing_item_assignments')
        .update({ status: 'declined' })
        .eq('item_id', itemId)
        .neq('id', assignment_id),
      supabase.from('sourcing_session_items')
        .update({ status: 'accepted' })
        .eq('id', itemId),
    ])

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
