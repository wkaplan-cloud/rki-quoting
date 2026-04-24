import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Split query into words and AND them — matches "casual pewter" across design + colour fields
  const words = q.split(/\s+/).filter(Boolean)
  let query = supabase
    .from('price_list_items')
    .select('id, brand, collection, design, colour, sku, product_id, price_zar, image_url, useable_width_cm')
  for (const word of words) {
    query = query.or(`design.ilike.%${word}%,colour.ilike.%${word}%,collection.ilike.%${word}%,sku.ilike.%${word}%,brand.ilike.%${word}%`)
  }
  const { data, error } = await query.limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
