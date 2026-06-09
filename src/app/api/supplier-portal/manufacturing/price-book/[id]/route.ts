import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()
  const allowed = ['item_type','category','name','unit','unit_custom','cost_price','supplier_quoted','apply_markup_default','supplier_name','supplier_contact','notes']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) { if (key in body) patch[key] = body[key] }
  if (patch.supplier_quoted) patch.cost_price = null

  const supabase = await createClient()
  const { error } = await supabase
    .from('mfg_price_book_items')
    .update(patch)
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const supabase = await createClient()
  // Archive instead of delete — preserves historical quote data
  const { error } = await supabase
    .from('mfg_price_book_items')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
