import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Search across design, colour, collection, sku — return top 20
  const { data, error } = await supabase
    .from('price_list_items')
    .select('id, brand, collection, design, colour, sku, price_zar, image_url')
    .or(`design.ilike.%${q}%,colour.ilike.%${q}%,collection.ilike.%${q}%,sku.ilike.%${q}%`)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
