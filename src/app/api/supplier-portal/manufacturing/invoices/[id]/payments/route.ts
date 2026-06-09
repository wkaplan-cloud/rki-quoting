import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()
  const supabase = await createClient()

  // Verify invoice ownership
  const { data: invoice } = await supabase
    .from('mfg_invoices')
    .select('id, total')
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: payment, error } = await supabase
    .from('mfg_invoice_payments')
    .insert({
      invoice_id:     id,
      amount:         body.amount,
      payment_date:   body.payment_date ?? new Date().toISOString().split('T')[0],
      payment_method: body.payment_method ?? 'eft',
      reference:      body.reference ?? null,
      notes:          body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update invoice payment status
  await supabase.rpc('update_mfg_invoice_payment_status', { p_invoice_id: id })

  // Log activity
  await supabase.from('mfg_activity_log').insert({
    portal_account_id: auth.portalAccountId,
    entity_type: 'invoice', entity_id: id,
    action: 'payment_recorded',
    metadata: { amount: body.amount, method: body.payment_method },
  })

  return NextResponse.json(payment)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const url = new URL(req.url)
  const paymentId = url.searchParams.get('payment_id')
  if (!paymentId) return NextResponse.json({ error: 'payment_id required' }, { status: 400 })

  const supabase = await createClient()
  await supabase.from('mfg_invoice_payments').delete().eq('id', paymentId)
  await supabase.rpc('update_mfg_invoice_payment_status', { p_invoice_id: id })

  return NextResponse.json({ ok: true })
}
