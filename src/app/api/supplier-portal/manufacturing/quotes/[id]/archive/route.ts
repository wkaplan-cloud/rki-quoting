import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveMfgAuth } from '@/lib/mfg-auth'

const ARCHIVABLE = ['draft', 'sent', 'accepted', 'declined', 'expired', 'superseded']

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveMfgAuth()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('mfg_quotes')
    .select('status')
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)
    .single()

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ARCHIVABLE.includes(quote.status)) {
    return NextResponse.json({ error: `Cannot archive a quote with status "${quote.status}"` }, { status: 400 })
  }

  const { error } = await supabase
    .from('mfg_quotes')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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
    .from('mfg_quotes')
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('portal_account_id', auth.portalAccountId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
