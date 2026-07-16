import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import type { SupabaseClient } from '@supabase/supabase-js'

function isPlatformAdmin(email: string | undefined) {
  return !!(email && process.env.PLATFORM_ADMIN_EMAIL && email.toLowerCase() === process.env.PLATFORM_ADMIN_EMAIL.toLowerCase())
}

// Platform admin writes bypass RLS (platform lists have no org_id); everyone else
// goes through the RLS client, which scopes writes to their own org's lists.
async function getDb(supabase: SupabaseClient, email: string | undefined) {
  return isPlatformAdmin(email) ? supabaseAdmin : supabase
}

function itemFields(item: Record<string, string | null | undefined>) {
  return {
    brand: item.brand || null,
    collection: item.collection || null,
    design: item.design || null,
    colour: item.colour || null,
    sku: item.sku || null,
    product_id: item.product_id || null,
    price_zar: item.price_zar ? parseFloat(String(item.price_zar)) : null,
    image_url: item.image_url || null,
  }
}

async function recountItems(db: SupabaseClient, priceListId: string) {
  const { count } = await db
    .from('price_list_items')
    .select('id', { count: 'exact', head: true })
    .eq('price_list_id', priceListId)
  await db.from('price_lists').update({ item_count: count ?? 0 }).eq('id', priceListId)
}

// GET — search or browse items in a price list (?q= optional, max 60 rows)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb(supabase, user.email)
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  let query = db
    .from('price_list_items')
    .select('id, brand, collection, design, colour, sku, product_id, price_zar, image_url, useable_width_cm')
    .eq('price_list_id', id)
  for (const word of q.split(/\s+/).filter(Boolean)) {
    query = query.or(`design.ilike.%${word}%,colour.ilike.%${word}%,collection.ilike.%${word}%,sku.ilike.%${word}%,brand.ilike.%${word}%`)
  }
  const { data, error } = await query.order('brand').order('collection').order('design').limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
  } catch (e) {
    return apiError(e)
  }
}

// POST — append a batch of items to an existing price list
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = await getDb(supabase, user.email)

  // Verify visibility (RLS will enforce write access too, but explicit check gives a clean 404)
  const { data: pl } = await db.from('price_lists').select('id').eq('id', id).single()
  if (!pl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { items, total_count, recount } = await req.json()
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 })

  const rows = (items as Record<string, string>[]).map(item => ({ price_list_id: id, ...itemFields(item) }))

  const { error } = await db.from('price_list_items').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On the final batch, update the item_count
  if (total_count != null) {
    await db.from('price_lists').update({ item_count: total_count }).eq('id', id)
  } else if (recount) {
    await recountItems(db, id)
  }

  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// PATCH — edit a single item
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId, ...fields } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const db = await getDb(supabase, user.email)
  const { data, error } = await db
    .from('price_list_items')
    .update(itemFields(fields))
    .eq('id', itemId)
    .eq('price_list_id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE — remove a single item
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const db = await getDb(supabase, user.email)
  const { data, error } = await db
    .from('price_list_items')
    .delete()
    .eq('id', itemId)
    .eq('price_list_id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await recountItems(db, id)
  return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
