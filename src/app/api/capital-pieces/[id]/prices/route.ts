import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PUT /api/capital-pieces/[id]/prices — upsert a supplier price (for the piece or a specific variant)
// Body: { supplier_id, supplier_name, cost_price, notes?, variant_id? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as {
      supplier_id: string
      supplier_name: string
      cost_price: number
      notes?: string
      variant_id?: string | null
    }
    if (!body.supplier_id || body.cost_price == null) {
      return NextResponse.json({ error: 'supplier_id and cost_price are required' }, { status: 400 })
    }

    const variantId = body.variant_id ?? null

    // Manual upsert to work with partial unique indexes
    const existing = variantId
      ? await supabase.from('capital_piece_prices').select('id').eq('variant_id', variantId).eq('supplier_id', body.supplier_id).maybeSingle()
      : await supabase.from('capital_piece_prices').select('id').eq('capital_piece_id', id).eq('supplier_id', body.supplier_id).is('variant_id', null).maybeSingle()

    const payload = {
      capital_piece_id: id,
      org_id: orgId,
      supplier_id: body.supplier_id,
      supplier_name: body.supplier_name,
      cost_price: body.cost_price,
      notes: body.notes?.trim() ?? null,
      variant_id: variantId,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existing.data?.id) {
      result = await supabase.from('capital_piece_prices').update(payload).eq('id', existing.data.id).select().single()
    } else {
      result = await supabase.from('capital_piece_prices').insert(payload).select().single()
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json({ price: result.data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/capital-pieces/[id]/prices?supplier_id=xxx&variant_id=yyy
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplier_id')
    const variantId = url.searchParams.get('variant_id') // null means piece-level price

    if (!supplierId) return NextResponse.json({ error: 'supplier_id is required' }, { status: 400 })

    let query = supabase.from('capital_piece_prices').delete().eq('capital_piece_id', id).eq('supplier_id', supplierId)
    if (variantId) query = query.eq('variant_id', variantId)
    else query = query.is('variant_id', null)

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
