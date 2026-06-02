import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// GET /api/capital-pieces/[id]/variants
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('capital_piece_variants')
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)')
      .eq('piece_id', id)
      .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ variants: data ?? [] })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/capital-pieces/[id]/variants
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { label: string; dimensions?: string; sort_order?: number }
    if (!body.label?.trim()) return NextResponse.json({ error: 'Label is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('capital_piece_variants')
      .insert({
        piece_id: id,
        org_id: orgId,
        label: body.label.trim(),
        dimensions: body.dimensions?.trim() ?? null,
        sort_order: body.sort_order ?? 0,
      })
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ variant: data })
  } catch (e) {
    return apiError(e)
  }
}
