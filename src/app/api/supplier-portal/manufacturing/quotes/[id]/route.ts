import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const supabase = await createClient()

  const { data: quote, error } = await supabase
    .from('mfg_quotes')
    .select(`
      *,
      job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, client_type, contact_person, email, phone, address, vat_number))
    `)
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: lineItems } = await supabase
    .from('mfg_quote_line_items')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order')

  const lineItemIds = (lineItems ?? []).map(li => li.id)

  const [{ data: materials }, { data: hardware }] = await Promise.all([
    lineItemIds.length
      ? supabase.from('mfg_cost_materials').select('*').in('line_item_id', lineItemIds).order('sort_order')
      : { data: [] },
    lineItemIds.length
      ? supabase.from('mfg_cost_hardware').select('*').in('line_item_id', lineItemIds).order('sort_order')
      : { data: [] },
  ])

  const lineItemsFull = (lineItems ?? []).map(li => ({
    ...li,
    materials: (materials ?? []).filter(m => m.line_item_id === li.id),
    hardware:  (hardware ?? []).filter(h => h.line_item_id === li.id),
  }))

  // Fetch activity log
  const { data: activity } = await supabase
    .from('mfg_activity_log')
    .select('*')
    .eq('entity_type', 'quote')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ ...quote, line_items: lineItemsFull, activity: activity ?? [] })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()
  const allowed = ['status','apply_vat','vat_rate','show_unit_price','valid_until','notes','acceptance_date','sent_to_email','sent_by_name','sent_by_email','sent_by_phone','sent_at']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) { if (key in body) patch[key] = body[key] }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mfg_quotes')
    .update(patch)
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
