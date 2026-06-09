import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function GET() {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_clients')
    .select('*')
    .eq('portal_account_id', auth.portalAccountId)
    .is('archived_at', null)
    .order('client_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mfg_clients')
    .insert({
      portal_account_id: auth.portalAccountId,
      client_type:    body.client_type ?? 'individual',
      client_name:    body.client_name,
      contact_person: body.contact_person ?? null,
      email:          body.email ?? null,
      phone:          body.phone ?? null,
      address:        body.address ?? null,
      vat_number:     body.vat_number ?? null,
      notes:          body.notes ?? null,
      referred_by:    body.referred_by ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
