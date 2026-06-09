import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json()
  const allowed = ['client_type','client_name','contact_person','email','phone','address','vat_number','notes','referred_by']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) patch[key] = body[key] }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mfg_clients')
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
  const { error } = await supabase
    .from('mfg_clients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
