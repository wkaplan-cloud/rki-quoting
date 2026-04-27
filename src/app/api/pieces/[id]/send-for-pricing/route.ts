import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/pieces/[id]/send-for-pricing
// Creates a sourcing session pre-filled with this piece as an item, returns session id
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: piece } = await supabase
      .from('pieces')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()

    if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404 })

    // Create a draft sourcing session
    const { data: session, error: sessionError } = await supabase
      .from('sourcing_sessions')
      .insert({
        org_id: orgId,
        user_id: user.id,
        title: `Price update: ${piece.name}`,
      })
      .select()
      .single()

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

    // Add the piece as the first item
    const { error: itemError } = await supabase
      .from('sourcing_session_items')
      .insert({
        session_id: session.id,
        title: piece.name,
        work_type: piece.work_type ?? null,
        specifications: piece.description ?? null,
        item_quantity: 1,
        dimensions: piece.dimensions ?? null,
        colour_finish: piece.colour_finish ?? null,
        sort_order: 0,
        piece_id: piece.id,
      })

    if (itemError) {
      // piece_id column may not exist yet — retry without it
      await supabase
        .from('sourcing_session_items')
        .insert({
          session_id: session.id,
          title: piece.name,
          work_type: piece.work_type ?? null,
          specifications: piece.description ?? null,
          item_quantity: 1,
          dimensions: piece.dimensions ?? null,
          colour_finish: piece.colour_finish ?? null,
          sort_order: 0,
        })
    }

    return NextResponse.json({ session_id: session.id })
  } catch (e) {
    return apiError(e)
  }
}
