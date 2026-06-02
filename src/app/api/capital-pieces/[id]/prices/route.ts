import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PUT /api/capital-pieces/[id]/prices — upsert a supplier price for a piece
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { supplier_id: string; supplier_name: string; cost_price: number; notes?: string }
    if (!body.supplier_id || body.cost_price == null) return NextResponse.json({ error: 'supplier_id and cost_price are required' }, { status: 400 })

    const { data, error } = await supabase
      .from('capital_piece_prices')
      .upsert({
        capital_piece_id: id,
        org_id: orgId,
        supplier_id: body.supplier_id,
        supplier_name: body.supplier_name,
        cost_price: body.cost_price,
        notes: body.notes?.trim() ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'capital_piece_id,supplier_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ price: data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/capital-pieces/[id]/prices?supplier_id=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supplierId = new URL(req.url).searchParams.get('supplier_id')
    if (!supplierId) return NextResponse.json({ error: 'supplier_id is required' }, { status: 400 })

    const { error } = await supabase
      .from('capital_piece_prices')
      .delete()
      .eq('capital_piece_id', id)
      .eq('supplier_id', supplierId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
