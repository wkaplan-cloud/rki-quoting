import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/capital-hotels/[requestId]/items/[itemId] — assign a capital piece + supplier price to an item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string; itemId: string }> }
) {
  try {
    const { requestId, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      capital_piece_id?: string | null
      piece_name?: string | null
      supplier_id?: string | null
      supplier_name?: string | null
      cost_price?: number | null
      markup_percentage?: number | null
    }

    // Verify the item belongs to the request (RLS handles org scoping)
    const { data: item } = await supabase
      .from('capital_request_items')
      .select('id')
      .eq('id', itemId)
      .eq('request_id', requestId)
      .single()

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    if (body.capital_piece_id !== undefined) patch.capital_piece_id = body.capital_piece_id
    if (body.piece_name !== undefined) patch.piece_name = body.piece_name
    if (body.supplier_id !== undefined) patch.supplier_id = body.supplier_id
    if (body.supplier_name !== undefined) patch.supplier_name = body.supplier_name
    if (body.cost_price !== undefined) patch.cost_price = body.cost_price
    if (body.markup_percentage !== undefined) patch.markup_percentage = body.markup_percentage

    const { data, error } = await supabase
      .from('capital_request_items')
      .update(patch)
      .eq('id', itemId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch (e) {
    return apiError(e)
  }
}
