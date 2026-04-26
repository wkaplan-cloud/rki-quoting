import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function getPortalAccountId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

// GET /api/supplier-portal/price-list — list items
export async function GET() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portalAccountId = await getPortalAccountId(user.id)
  if (!portalAccountId) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const { data: items, error } = await supabaseAdmin
    .from('supplier_price_list_items')
    .select('*')
    .eq('portal_account_id', portalAccountId)
    .order('sort_order')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: items ?? [] })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/supplier-portal/price-list — create a single item
export async function POST(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portalAccountId = await getPortalAccountId(user.id)
  if (!portalAccountId) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const body = await req.json() as {
    item_name: string
    description?: string | null
    sku?: string | null
    unit?: string | null
    price?: number | null
    lead_time_weeks?: number | null
    image_url?: string | null
    sort_order?: number
  }

  if (!body.item_name?.trim()) return NextResponse.json({ error: 'item_name required' }, { status: 400 })

  const { data: item, error } = await supabaseAdmin
    .from('supplier_price_list_items')
    .insert({
      portal_account_id: portalAccountId,
      item_name: body.item_name.trim(),
      description: body.description?.trim() || null,
      sku: body.sku?.trim() || null,
      unit: body.unit?.trim() || null,
      price: body.price ?? null,
      lead_time_weeks: body.lead_time_weeks ?? null,
      image_url: body.image_url ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item })
  } catch (e) {
    return apiError(e)
  }
}

// PATCH /api/supplier-portal/price-list?item_id=X — update item
export async function PATCH(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portalAccountId = await getPortalAccountId(user.id)
  if (!portalAccountId) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const body = await req.json()

  const { data: item, error } = await supabaseAdmin
    .from('supplier_price_list_items')
    .update({
      item_name: body.item_name?.trim(),
      description: body.description?.trim() || null,
      sku: body.sku?.trim() || null,
      unit: body.unit?.trim() || null,
      price: body.price ?? null,
      lead_time_weeks: body.lead_time_weeks ?? null,
      image_url: body.image_url ?? null,
    })
    .eq('id', itemId)
    .eq('portal_account_id', portalAccountId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/supplier-portal/price-list?item_id=X — delete item
export async function DELETE(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portalAccountId = await getPortalAccountId(user.id)
  if (!portalAccountId) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('supplier_price_list_items')
    .delete()
    .eq('id', itemId)
    .eq('portal_account_id', portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
