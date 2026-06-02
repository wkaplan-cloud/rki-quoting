import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/capital-pieces/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { name?: string; description?: string; category?: string; image_url?: string }
    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.description !== undefined) patch.description = body.description.trim() || null
    if (body.category !== undefined) patch.category = body.category
    if (body.image_url !== undefined) patch.image_url = body.image_url || null

    const { data, error } = await supabase
      .from('capital_pieces')
      .update(patch)
      .eq('id', id)
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, updated_at)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ piece: data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/capital-pieces/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('capital_pieces').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
