import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

// Converts an accepted quote into one or two invoices (full, or deposit+final).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const { invoice_type, deposit_percentage } = await req.json()
  // invoice_type: 'full' | 'deposit'
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('mfg_quotes')
    .select('*, job:mfg_jobs(id)')
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const { data: settings } = await supabase
    .from('mfg_settings')
    .select('invoice_prefix, default_deposit_percentage')
    .eq('portal_account_id', auth.portalAccountId)
    .maybeSingle()

  const prefix = settings?.invoice_prefix ?? 'INV'
  const { data: numData } = await supabase.rpc('get_next_mfg_invoice_number', { p_portal_account_id: auth.portalAccountId })
  const num = String(numData ?? 1).padStart(3, '0')
  const baseNumber = `${prefix}-${num}`

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const invoices = []

  if (invoice_type === 'full' || !invoice_type) {
    const { data: inv, error } = await supabase
      .from('mfg_invoices')
      .insert({
        portal_account_id: auth.portalAccountId,
        quote_id:          id,
        job_id:            quote.job_id,
        invoice_number:    baseNumber,
        invoice_type:      'full',
        status:            'draft',
        apply_vat:         quote.apply_vat,
        vat_rate:          quote.vat_rate,
        subtotal:          quote.subtotal,
        vat_amount:        quote.vat_amount,
        total:             quote.total,
        due_date:          dueDateStr,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invoices.push(inv)
  } else if (invoice_type === 'deposit') {
    const pct = deposit_percentage ?? settings?.default_deposit_percentage ?? 50

    // Split on ex-VAT subtotal — SARS requires VAT on each portion separately
    const depositSubtotal = Math.round(quote.subtotal * pct / 100 * 100) / 100
    const finalSubtotal   = Math.round((quote.subtotal - depositSubtotal) * 100) / 100
    const depositVat      = quote.apply_vat ? Math.round(depositSubtotal * quote.vat_rate) / 100 : 0
    const finalVat        = quote.apply_vat ? Math.round(finalSubtotal   * quote.vat_rate) / 100 : 0
    const depositTotal    = Math.round((depositSubtotal + depositVat) * 100) / 100
    const finalTotal      = Math.round((finalSubtotal   + finalVat)   * 100) / 100

    const [{ data: depInv, error: dErr }, { data: finInv, error: fErr }] = await Promise.all([
      supabase.from('mfg_invoices').insert({
        portal_account_id: auth.portalAccountId,
        quote_id: id, job_id: quote.job_id,
        invoice_number: `${baseNumber}-DEPOSIT`, invoice_type: 'deposit', status: 'draft',
        apply_vat: quote.apply_vat, vat_rate: quote.vat_rate,
        subtotal: depositSubtotal, vat_amount: depositVat, total: depositTotal,
        due_date: dueDateStr,
      }).select().single(),
      supabase.from('mfg_invoices').insert({
        portal_account_id: auth.portalAccountId,
        quote_id: id, job_id: quote.job_id,
        invoice_number: `${baseNumber}-FINAL`, invoice_type: 'final', status: 'draft',
        apply_vat: quote.apply_vat, vat_rate: quote.vat_rate,
        subtotal: finalSubtotal, vat_amount: finalVat, total: finalTotal,
        due_date: dueDateStr,
      }).select().single(),
    ])
    if (dErr || fErr) return NextResponse.json({ error: dErr?.message ?? fErr?.message }, { status: 500 })
    invoices.push(depInv, finInv)
  }

  // Mark quote as invoiced
  await supabase.from('mfg_quotes').update({ status: 'invoiced', updated_at: new Date().toISOString() }).eq('id', id)

  // Log
  await supabase.from('mfg_activity_log').insert({
    portal_account_id: auth.portalAccountId,
    entity_type: 'quote', entity_id: id,
    action: 'converted_to_invoice',
    metadata: { invoice_ids: invoices.map((i: { id: string }) => i?.id) },
  })

  return NextResponse.json({ invoices })
}
