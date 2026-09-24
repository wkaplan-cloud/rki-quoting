import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveAccountOrStaff } from '@/lib/portal-account'
import { DEVICE_COLS, toPublicDevice, deviceFields, resolveDeviceLinks } from '@/lib/devices'
import type { ElecDeviceInput } from '@/lib/elec-types'

async function who() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return resolveAccountOrStaff(user.id)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await who()
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as ElecDeviceInput
    const patch: Record<string, unknown> = { ...deviceFields(body), updated_at: new Date().toISOString() }
    if ('client_id' in body || 'quote_id' in body) {
      const { data: current } = await supabaseAdmin
        .from('elec_devices').select('client_id, quote_id').eq('id', id).eq('portal_account_id', account.accountId).maybeSingle()
      if (!current) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
      const links = await resolveDeviceLinks(account.accountId,
        'client_id' in body ? body.client_id : current.client_id,
        'quote_id' in body ? body.quote_id : current.quote_id)
      if ('error' in links) return NextResponse.json({ error: links.error }, { status: 400 })
      Object.assign(patch, links)
    }

    const { data, error } = await supabaseAdmin
      .from('elec_devices').update(patch).eq('id', id).eq('portal_account_id', account.accountId)
      .select(DEVICE_COLS).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    return NextResponse.json({ device: toPublicDevice(data as never) })
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await who()
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabaseAdmin.from('elec_devices').delete().eq('id', id).eq('portal_account_id', account.accountId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
