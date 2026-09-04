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
    quote_id:          quoteId,
    sort_order:        idx,
    description:       li.description ?? '',
    callout_note:      li.callout_note ?? null,
    quantity:          li.quantity ?? 1,
    unit_price:        li.unit_price ?? 0,
    line_total:        (li.unit_price ?? 0) * (li.quantity ?? 1),
    markup_percentage: li.markup_percentage ?? 30,
    pricing_mode:      li.pricing_mode === 'manual' ? 'manual' : 'built',
    // null means "no cost captured" — kept distinct from a genuine R0 cost so
    // uncosted lines stay out of the quote's cost and profit totals.
    cost_per_unit:     li.cost_per_unit ?? null,
    profit_per_unit:   li.profit_per_unit ?? 0,
    margin_percentage: li.margin_percentage ?? 0,
    option_label:      li.option_label ?? null,
    labour_hours:      li.labour_hours ?? 0,
    labour_rate:       li.labour_rate ?? 0,
  }))

  const { data: savedLineItems, error: liErr } = await supabase
    .from('mfg_quote_line_items')
    .insert(lineItemRows)
    .select('id')

  if (liErr) return NextResponse.json({ error: liErr.message }, { status: 500 })

  // Split unified components back into material/hardware rows for storage
  const materialRows: Record<string, unknown>[] = []
  const hardwareRows: Record<string, unknown>[] = []

  line_items.forEach((li, idx) => {
    const lineItemId = savedLineItems?.[idx]?.id
    if (!lineItemId) return

    ;(li.components ?? []).forEach((c: Record<string, unknown>, cidx: number) => {
      if (c._type === 'hardware') {
        hardwareRows.push({
          line_item_id:       lineItemId,
          price_book_item_id: c.price_book_item_id ?? null,
          item_name:          c.item_name,
          unit:               c.unit,
          quantity:           c.quantity ?? 1,
          unit_cost:          c.unit_cost ?? null,
          supplier_quoted:    c.supplier_quoted ?? false,
          apply_markup:       true,
          markup_percentage:  null,
          sort_order:         cidx,
        })
      } else {
        materialRows.push({
          line_item_id:       lineItemId,
          price_book_item_id: c.price_book_item_id ?? null,
          item_name:          c.item_name,
          unit:               c.unit,
          quantity:           c.quantity ?? 1,
          unit_cost:          c.unit_cost ?? null,
          supplier_quoted:    c.supplier_quoted ?? false,
          sort_order:         cidx,
        })
      }
    })
  })

  if (materialRows.length) await supabase.from('mfg_cost_materials').insert(materialRows)
  if (hardwareRows.length) await supabase.from('mfg_cost_hardware').insert(hardwareRows)

  // Recalculate quote totals (computes subtotal from line items)
  await supabase.rpc('recalculate_mfg_quote_totals', { p_quote_id: quoteId })

  // Re-apply delivery/installation to the computed total
  const { data: updatedQuote } = await supabase
    .from('mfg_quotes')
    .select('subtotal, apply_vat, vat_rate, delivery_cost, installation_cost')
    .eq('id', quoteId)
    .single()

  if (updatedQuote) {
    const taxable  = (updatedQuote.subtotal ?? 0) + (updatedQuote.delivery_cost ?? 0) + (updatedQuote.installation_cost ?? 0)
    const vatAmt   = updatedQuote.apply_vat ? taxable * ((updatedQuote.vat_rate ?? 15) / 100) : 0
    await supabase
      .from('mfg_quotes')
      .update({ vat_amount: vatAmt, total: taxable + vatAmt })
      .eq('id', quoteId)
  }

  return NextResponse.json({ ok: true })
}
