import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// GET /api/capital-pieces
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('capital_pieces')
      .select(`
        *,
        prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id),
        variants:capital_piece_variants(
          id, label, dimensions, sort_order,
          prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)
        ),
        hotels:capital_piece_hotels(id, hotel_id, hotel:capital_hotels(id, name))
      `)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pieces: data ?? [] })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/capital-pieces
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { name: string; description?: string; category?: string; fabric?: string; image_url?: string; hotel_ids?: string[] }
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('capital_pieces')
      .insert({
        org_id: orgId,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        category: body.category ?? 'general',
        fabric: body.fabric?.trim() ?? null,
        image_url: body.image_url ?? null,
      })
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id), variants:capital_piece_variants(id, label, dimensions, sort_order, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)), hotels:capital_piece_hotels(id, hotel_id, hotel:capital_hotels(id, name))')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (body.hotel_ids?.length) {
      await supabase.from('capital_piece_hotels').insert(
        body.hotel_ids.map(hotel_id => ({ piece_id: data.id, hotel_id, org_id: orgId }))
      )
    }

    return NextResponse.json({ piece: data })
  } catch (e) {
    return apiError(e)
  }
}
