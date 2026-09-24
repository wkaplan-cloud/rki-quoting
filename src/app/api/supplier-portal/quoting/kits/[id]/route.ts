import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { validateKit, kitItemRows, type KitInput } from '@/lib/kits'

async function ownedKit(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const account = await resolvePortalAccount(user.id)
  if (!account) return { error: NextResponse.json({ error: 'No account' }, { status: 404 }) }
  const { data: kit } = await supabaseAdmin
    .from('elec_kits').select('id').eq('id', id).eq('portal_account_id', account.id).maybeSingle()
  if (!kit) return { error: NextResponse.json({ error: 'Kit not found' }, { status: 404 }) }
  return { accountId: account.id }
}

/** Replaces the kit's name, description and every line. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownedKit(id)
    if (owned.error) return owned.error

    const body = await req.json() as KitInput
    const invalid = validateKit(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('elec_kits')
      .update({ name: body.name.trim(), description: body.description?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('portal_account_id', owned.accountId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { error: delErr } = await supabaseAdmin.from('elec_kit_items').delete().eq('kit_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    const { error: insErr } = await supabaseAdmin.from('elec_kit_items').insert(kitItemRows(id, body.items))
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownedKit(id)
    if (owned.error) return owned.error

    const { error } = await supabaseAdmin.from('elec_kits').delete().eq('id', id).eq('portal_account_id', owned.accountId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
