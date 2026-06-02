import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/capital-pieces/[id]/variants/[variantId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const { variantId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { label?: string; dimensions?: string }
    const patch: Record<string, unknown> = {}
    if (body.label !== undefined) patch.label = body.label.trim()
    if (body.dimensions !== undefined) patch.dimensions = body.dimensions.trim() || null

    const { data, error } = await supabase
      .from('capital_piece_variants')
      .update(patch)
      .eq('id', variantId)
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ variant: data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/capital-pieces/[id]/variants/[variantId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const { variantId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('capital_piece_variants').delete().eq('id', variantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
