import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PUT /api/capital-pieces/[id]/hotels — add a hotel tag to a piece
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { hotel_id } = await req.json() as { hotel_id: string }
    if (!hotel_id) return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('capital_piece_hotels')
      .insert({ piece_id: id, hotel_id, org_id: orgId })
      .select('id, hotel_id, hotel:capital_hotels(id, name)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tag: data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/capital-pieces/[id]/hotels?hotel_id=... — remove a hotel tag
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const hotel_id = new URL(req.url).searchParams.get('hotel_id')
    if (!hotel_id) return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 })

    const { error } = await supabase
      .from('capital_piece_hotels')
      .delete()
      .eq('piece_id', id)
      .eq('hotel_id', hotel_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
