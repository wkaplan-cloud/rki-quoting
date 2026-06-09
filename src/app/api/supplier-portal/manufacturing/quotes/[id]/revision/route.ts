import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

// Creates a new revision of a quote by duplicating all line items and cost build rows.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const supabase = await createClient()

  // Load existing quote
  const { data: original } = await supabase
    .from('mfg_quotes')
    .select('*, line_items:mfg_quote_line_items(*)')
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)
    .single()
  if (!original) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  // Load cost rows for all line items
  const liIds = (original.line_items ?? []).map((li: { id: string }) => li.id)
  const [{ data: materials }, { data: hardware }] = await Promise.all([
    liIds.length ? supabase.from('mfg_cost_materials').select('*').in('line_item_id', liIds) : { data: [] },
    liIds.length ? supabase.from('mfg_cost_hardware').select('*').in('line_item_id', liIds) : { data: [] },
  ])

  // Determine new revision number
  const { data: existing } = await supabase
    .from('mfg_quotes')
    .select('revision_number')
    .eq('portal_account_id', auth.portalAccountId)
    .eq('quote_number', original.quote_number)
    .order('revision_number', { ascending: false })
    .limit(1)
    .single()
  const newRevision = (existing?.revision_number ?? original.revision_number) + 1

  // Create new quote row
  const { id: _id, created_at: _c, updated_at: _u, sent_at: _s, sent_to_email: _st, acceptance_date: _ad, ...rest } = original
  const { data: newQuote, error: qErr } = await supabase
    .from('mfg_quotes')
    .insert({
      ...rest,
      revision_number: newRevision,
      status: 'draft',
      subtotal: original.subtotal,
      vat_amount: original.vat_amount,
      total: original.total,
      total_cost: original.total_cost,
      total_profit: original.total_profit,
      line_items: undefined,
    })
    .select('id')
    .single()
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Duplicate line items
  for (const li of (original.line_items ?? [])) {
    const { id: oldId, created_at: _lc, updated_at: _lu, quote_id: _q, ...liRest } = li
    const { data: newLi } = await supabase
      .from('mfg_quote_line_items')
      .insert({ ...liRest, quote_id: newQuote.id })
      .select('id')
      .single()
    if (!newLi) continue

    const liMaterials = (materials ?? []).filter((m: { line_item_id: string }) => m.line_item_id === oldId)
    const liHardware  = (hardware ?? []).filter((h: { line_item_id: string }) => h.line_item_id === oldId)

    if (liMaterials.length) {
      await supabase.from('mfg_cost_materials').insert(
        liMaterials.map(({ id: _mi, ...m }: { id: string; [k: string]: unknown }) => ({ ...m, line_item_id: newLi.id }))
      )
    }
    if (liHardware.length) {
      await supabase.from('mfg_cost_hardware').insert(
        liHardware.map(({ id: _hi, ...h }: { id: string; [k: string]: unknown }) => ({ ...h, line_item_id: newLi.id }))
      )
    }
  }

  // Log activity
  await supabase.from('mfg_activity_log').insert({
    portal_account_id: auth.portalAccountId,
    entity_type: 'quote', entity_id: newQuote.id,
    action: 'revision_created',
    metadata: { original_id: id, revision_number: newRevision },
  })

  return NextResponse.json({ id: newQuote.id, revision_number: newRevision })
}
