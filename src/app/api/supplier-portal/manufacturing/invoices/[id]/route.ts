import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const supabase = await createClient()

  const [{ data: invoice }, { data: payments }, { data: activity }] = await Promise.all([
    supabase
      .from('mfg_invoices')
      .select('*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, client_type, contact_person, email, phone, address, vat_number)), quote:mfg_quotes(id, quote_number, revision_number)')
      .eq('id', id)
      .eq('portal_account_id', auth.portalAccountId)
      .single(),
    supabase
      .from('mfg_invoice_payments')
      .select('*')
      .eq('invoice_id', id)
      .order('payment_date'),
    supabase
      .from('mfg_activity_log')
      .select('*')
      .eq('entity_type', 'invoice')
      .eq('entity_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...invoice, payments: payments ?? [], activity: activity ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()
  const allowed = ['status','sent_to_email','sent_at','sent_by_name','sent_by_email','sent_by_phone','due_date','notes']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) { if (key in body) patch[key] = body[key] }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mfg_invoices')
    .update(patch)
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
