import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET() {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_settings')
    .select('*')
    .eq('portal_account_id', auth.portalAccountId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create settings row if first time
  if (!data) {
    const { data: created, error: createErr } = await supabase
      .from('mfg_settings')
      .insert({ portal_account_id: auth.portalAccountId })
      .select()
      .single()
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    return NextResponse.json(created)
  }

  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const allowed = [
    'business_name', 'logo_url', 'address', 'email', 'phone',
    'company_registration_number', 'vat_registered', 'vat_registration_number',
    'bank_name', 'bank_account_holder', 'bank_account_number', 'bank_branch_code', 'bank_account_type',
    'default_vat_rate', 'default_markup_percentage', 'quote_validity_days',
    'default_deposit_percentage', 'default_payment_terms', 'terms_and_conditions',
    'overhead_rate_per_hour',
    'quote_prefix', 'invoice_prefix', 'accent_color',
    'email_template_quote', 'email_template_invoice',
  ]
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }
  patch.updated_at = new Date().toISOString()

  const supabase = await createClient()
  const { error } = await supabase
    .from('mfg_settings')
    .upsert({ portal_account_id: auth.portalAccountId, ...patch }, { onConflict: 'portal_account_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
