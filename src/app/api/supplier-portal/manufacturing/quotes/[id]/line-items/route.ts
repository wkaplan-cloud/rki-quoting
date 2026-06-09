import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

// Save (upsert) all line items for a quote in one call.
// Deletes removed items, upserts existing/new items, saves cost build rows.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: quoteId } = await params
  const supabase = await createClient()

  // Verify ownership
  const { data: quote } = await supabase
    .from('mfg_quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('portal_account_id', auth.portalAccountId)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const { line_items } = await req.json()
  if (!Array.isArray(line_items)) return NextResponse.json({ error: 'line_items must be an array' }, { status: 400 })

  // Delete all existing line items (cascade deletes cost rows)
  await supabase.from('mfg_quote_line_items').delete().eq('quote_id', quoteId)

  // Insert line items
  const lineItemRows = line_items.map((li, idx) => ({
    quote_id:           quoteId,
    sort_order:         idx,
    description:        li.description ?? '',
    callout_note:       li.callout_note ?? null,
    quantity:           li.quantity ?? 1,
    unit_price:         li.unit_price ?? 0,
    line_total:         (li.unit_price ?? 0) * (li.quantity ?? 1),
    markup_percentage:  li.markup_percentage ?? 30,
    cost_per_unit:      li.cost_per_unit ?? 0,
    profit_per_unit:    li.profit_per_unit ?? 0,
    margin_percentage:  li.margin_percentage ?? 0,
    option_label:       li.option_label ?? null,
  }))

  const { data: savedLineItems, error: liErr } = await supabase
    .from('mfg_quote_line_items')
    .insert(lineItemRows)
    .select('id')

  if (liErr) return NextResponse.json({ error: liErr.message }, { status: 500 })

  // Insert cost rows
  const materialRows: Record<string, unknown>[] = []
  const hardwareRows: Record<string, unknown>[] = []

  line_items.forEach((li, idx) => {
    const lineItemId = savedLineItems?.[idx]?.id
    if (!lineItemId) return

    ;(li.materials ?? []).forEach((m: Record<string, unknown>, midx: number) => {
      materialRows.push({
        line_item_id:       lineItemId,
        price_book_item_id: m.price_book_item_id ?? null,
        item_name:          m.item_name,
        unit:               m.unit,
        quantity:           m.quantity ?? 1,
        unit_cost:          m.unit_cost ?? null,
        supplier_quoted:    m.supplier_quoted ?? false,
        sort_order:         midx,
      })
    })

    ;(li.hardware ?? []).forEach((h: Record<string, unknown>, hidx: number) => {
      hardwareRows.push({
        line_item_id:       lineItemId,
        price_book_item_id: h.price_book_item_id ?? null,
        item_name:          h.item_name,
        unit:               h.unit,
        quantity:           h.quantity ?? 1,
        unit_cost:          h.unit_cost ?? null,
        supplier_quoted:      h.supplier_quoted ?? false,
        apply_markup:         h.apply_markup ?? false,
        markup_percentage:    h.markup_percentage ?? null,
        sort_order:           hidx,
      })
    })
  })

  if (materialRows.length) await supabase.from('mfg_cost_materials').insert(materialRows)
  if (hardwareRows.length) await supabase.from('mfg_cost_hardware').insert(hardwareRows)

  // Recalculate quote totals
  await supabase.rpc('recalculate_mfg_quote_totals', { p_quote_id: quoteId })

  return NextResponse.json({ ok: true })
}
