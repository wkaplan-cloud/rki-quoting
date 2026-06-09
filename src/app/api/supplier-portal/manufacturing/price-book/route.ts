import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET() {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_price_book_items')
    .select('*')
    .eq('portal_account_id', auth.portalAccountId)
    .is('archived_at', null)
    .order('item_type').order('category').order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_price_book_items')
    .insert({
      portal_account_id:    auth.portalAccountId,
      item_type:            body.item_type,
      category:             body.category,
      name:                 body.name,
      unit:                 body.unit,
      unit_custom:          body.unit_custom ?? null,
      cost_price:           body.supplier_quoted ? null : (body.cost_price ?? null),
      supplier_quoted:      body.supplier_quoted ?? false,
      apply_markup_default: body.apply_markup_default ?? true,
      supplier_name:        body.supplier_name ?? null,
      supplier_contact:     body.supplier_contact ?? null,
      notes:                body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
