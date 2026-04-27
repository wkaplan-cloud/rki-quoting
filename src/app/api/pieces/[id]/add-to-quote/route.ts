import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/pieces/[id]/add-to-quote
// Body: { project_id, markup_percentage?, quantity? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project_id, markup_percentage, quantity } = await req.json() as {
      project_id: string
      markup_percentage?: number
      quantity?: number
    }

    if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

    const { data: piece } = await supabase
      .from('pieces')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404 })

    // Fetch delivery address from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('business_name, business_address')
      .maybeSingle()

    const deliveryAddress = settings?.business_address
      ? `${settings.business_name ?? ''}\n${settings.business_address}`.trim()
      : ''

    // Get max sort_order in project
    const { data: lastItem } = await supabase
      .from('line_items')
      .select('sort_order')
      .eq('project_id', project_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sort_order = (lastItem?.sort_order ?? -1) + 1
    const markup = markup_percentage ?? 0

    const { data: lineItem, error } = await supabase
      .from('line_items')
      .insert({
        project_id,
        item_name: piece.name,
        description: piece.description ?? null,
        quantity: quantity ?? 1,
        cost_price: piece.base_price ?? 0,
        markup_percentage: markup,
        supplier_id: piece.supplier_id ?? null,
        supplier_name: piece.supplier_name ?? null,
        dimensions: piece.dimensions ?? null,
        colour_finish: piece.colour_finish ?? null,
        delivery_address: deliveryAddress,
        sort_order,
        row_type: 'item',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: lineItem })
  } catch (e) {
    return apiError(e)
  }
}
