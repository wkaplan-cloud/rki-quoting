import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveAccountOrStaff } from '@/lib/portal-account'
import { resolveCreatorName } from '@/lib/resolve-creator'
import { DEVICE_COLS, toPublicDevice, deviceFields, resolveDeviceLinks } from '@/lib/devices'
import type { ElecDeviceInput } from '@/lib/elec-types'

/**
 * GET  ?quote_id=… | ?client_id=… | ?q=…   devices for a project, a site, or a search
 * POST                                     add a device
 *
 * Office users and field staff both use this — techs register devices on site.
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const who = await resolveAccountOrStaff(user.id)
    if (!who) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const sp = req.nextUrl.searchParams
    const quoteId = sp.get('quote_id')
    const clientId = sp.get('client_id')
    const q = (sp.get('q') ?? '').trim().replace(/[,()%]/g, ' ')

    let query = supabaseAdmin.from('elec_devices').select(DEVICE_COLS).eq('portal_account_id', who.accountId)
    if (quoteId) query = query.eq('quote_id', quoteId)
    if (clientId) query = query.eq('client_id', clientId)
    if (q) {
      // A support call starts from whatever the caller has: a serial, a MAC,
      // an IP, a model — or just the client's name.
      const { data: clients } = await supabaseAdmin
        .from('elec_clients').select('id').eq('portal_account_id', who.accountId).ilike('client_name', `%${q}%`).limit(50)
      const clientIds = (clients ?? []).map(c => c.id)
      const fields = ['serial_number', 'mac_address', 'ip_address', 'model', 'brand', 'room', 'description']
        .map(f => `${f}.ilike.%${q}%`)
      if (clientIds.length) fields.push(`client_id.in.(${clientIds.join(',')})`)
      query = query.or(fields.join(','))
    }

    const { data, error } = await query.order('room', { nullsFirst: false }).order('created_at').limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ devices: (data ?? []).map(r => toPublicDevice(r as never)) })
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const who = await resolveAccountOrStaff(user.id)
    if (!who) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json() as ElecDeviceInput
    const links = await resolveDeviceLinks(who.accountId, body.client_id, body.quote_id)
    if ('error' in links) return NextResponse.json({ error: links.error }, { status: 400 })

    const fields = deviceFields(body)
    if (!fields.model && !fields.description && !fields.serial_number && !fields.brand) {
      return NextResponse.json({ error: 'Give the device a make, model or description' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('elec_devices')
      .insert({
        portal_account_id: who.accountId,
        ...links,
        ...fields,
        created_by_name: who.staffName ?? await resolveCreatorName(user.id),
      })
      .select(DEVICE_COLS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ device: toPublicDevice(data as never) })
  } catch (e) {
    return apiError(e)
  }
}
