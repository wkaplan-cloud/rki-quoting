import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/capital-hotels/[requestId]/items/[itemId]
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
      capital_piece_variant_id?: string | null
      variant_label?: string | null
      dimensions?: string | null
      fabric?: string | null
      piece_image_url?: string | null
      supplier_id?: string | null
      supplier_name?: string | null
      cost_price?: number | null
      markup_percentage?: number | null
    }

    const { data: item } = await supabase
      .from('capital_request_items')
      .select('id')
      .eq('id', itemId)
      .eq('request_id', requestId)
      .single()

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    const fields = ['capital_piece_id', 'piece_name', 'capital_piece_variant_id', 'variant_label', 'dimensions', 'fabric', 'piece_image_url', 'supplier_id', 'supplier_name', 'cost_price', 'markup_percentage'] as const
    for (const f of fields) {
      if (body[f] !== undefined) patch[f] = body[f]
    }

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
