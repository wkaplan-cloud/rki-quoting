import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolvePortalAccount } from '@/lib/portal-account'
import { listKits, validateKit, kitItemRows, type KitInput } from '@/lib/kits'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    return NextResponse.json({ kits: await listKits(account.id) })
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as KitInput
    const invalid = validateKit(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { data: kit, error } = await supabaseAdmin
      .from('elec_kits')
      .insert({ portal_account_id: account.id, name: body.name.trim(), description: body.description?.trim() || null })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { error: itemsErr } = await supabaseAdmin.from('elec_kit_items').insert(kitItemRows(kit.id, body.items))
    if (itemsErr) {
      await supabaseAdmin.from('elec_kits').delete().eq('id', kit.id)
      return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }
    return NextResponse.json({ id: kit.id })
  } catch (e) {
    return apiError(e)
  }
}
