import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, supplier_name, items } = await req.json()
  if (!name || !items?.length) {
    return NextResponse.json({ error: 'name and items are required' }, { status: 400 })
  }

  const { data: priceList, error: plError } = await supabase
    .from('price_lists')
    .insert({ name, supplier_name: supplier_name ?? 'Home Fabrics', user_id: user.id, item_count: items.length })
    .select()
    .single()

  if (plError) return NextResponse.json({ error: plError.message }, { status: 500 })

  const chunkSize = 500
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize).map((item: Record<string, string>) => ({
      price_list_id: priceList.id,
      brand: item.brand || null,
      collection: item.collection || null,
      design: item.design || null,
      colour: item.colour || null,
      sku: item.sku || null,
      product_id: item.product_id || null,
      price_zar: item.price_zar ? parseFloat(item.price_zar) : null,
      image_url: item.image_url || null,
    }))

    const { error: itemsError } = await supabase.from('price_list_items').insert(chunk)
    if (itemsError) {
      await supabase.from('price_lists').delete().eq('id', priceList.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: priceList.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('price_lists').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
