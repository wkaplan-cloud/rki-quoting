import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — append a batch of items to an existing price list
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify org membership (RLS will enforce this too, but explicit check gives a clean 404)
  const { data: pl } = await supabase
    .from('price_lists')
    .select('id')
    .eq('id', id)
    .single()

  if (!pl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { items, total_count } = await req.json()
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

  const rows = items.map((item: Record<string, string>) => ({
    price_list_id: id,
    brand: item.brand || null,
    collection: item.collection || null,
    design: item.design || null,
    colour: item.colour || null,
    sku: item.sku || null,
    product_id: item.product_id || null,
    price_zar: item.price_zar ? parseFloat(item.price_zar) : null,
    image_url: item.image_url || null,
  }))

  const { error } = await supabase.from('price_list_items').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On the final batch, update the item_count
  if (total_count != null) {
    await supabase.from('price_lists').update({ item_count: total_count }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
