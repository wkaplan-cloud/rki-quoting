import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { reverseGeocode } from '@/lib/reverse-geocode'

export async function POST(req: NextRequest) {
  try {
    const { punch_type, latitude, longitude, job_id, notes, punched_at: clientPunchedAt, idempotency_key } = await req.json() as {
      punch_type: 'clock_in' | 'clock_out'
      latitude?: number
      longitude?: number
      job_id?: string
      notes?: string
      punched_at?: string
      idempotency_key?: string
    }
    if (punch_type !== 'clock_in' && punch_type !== 'clock_out') {
      return NextResponse.json({ error: 'Invalid punch_type' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Resolve staff member from auth user
    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, name, portal_account_id, is_active')
      .eq('auth_user_id', user.id)
      .single()

    if (!staff || !staff.is_active) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    // Validate client-supplied timestamp if present
    const resolvedPunchedAt = clientPunchedAt && !isNaN(Date.parse(clientPunchedAt))
      ? clientPunchedAt
      : new Date().toISOString()

    // If an idempotency_key is provided, check for an existing punch first.
    // This makes offline queue replays safe — replaying the same punch twice
    // returns the original row instead of creating a duplicate.
    if (idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from('elec_time_punches')
        .select()
        .eq('idempotency_key', idempotency_key)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ ok: true, punch: existing, address: existing.address ?? null, deduplicated: true })
      }
    }

    const { data: punch, error } = await supabaseAdmin
      .from('elec_time_punches')
      .insert({
        portal_account_id: staff.portal_account_id,
        staff_id: staff.id,
        punch_type,
        punched_at: resolvedPunchedAt,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        job_id: job_id ?? null,
        notes: notes ?? null,
        idempotency_key: idempotency_key ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Resolve the address after the punch is safely stored, then write it back to
    // the row so the timesheet never has to geocode at render time.
    const address = latitude && longitude ? await reverseGeocode(latitude, longitude) : null
    if (address) {
      await supabaseAdmin.from('elec_time_punches').update({ address }).eq('id', punch.id)
      punch.address = address
    }
    const locationSource: 'gps' | 'none' = latitude && longitude ? 'gps' : 'none'

    const gpsNote = address ? ` · ${address}` : latitude ? ` · GPS captured` : ''
    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: staff.portal_account_id,
      type: punch_type,
      title: `${staff.name} ${punch_type === 'clock_in' ? 'clocked in' : 'clocked out'}`,
      body: `${punch_type === 'clock_in' ? 'Clocked in' : 'Clocked out'}${gpsNote}`,
      metadata: { staff_id: staff.id, punch_id: punch.id, job_card_id: job_id ?? null, latitude: latitude ?? null, longitude: longitude ?? null, address: address ?? null },
    })

    return NextResponse.json({ ok: true, punch, address: address ?? null, locationSource })
  } catch (e) {
    return apiError(e)
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, portal_account_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Last 7 days of punches for this staff member
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: punches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('*')
      .eq('staff_id', staff.id)
      .gte('punched_at', since)
      .order('punched_at', { ascending: false })

    // Global clock-in status is based only on punches with no job_id attached.
    // Job card clock-outs must not flip the global "on site" state.
    const lastGlobalPunch = (punches ?? []).find(p => !p.job_id) ?? null
    const lastPunch = punches?.[0] ?? null
    const isClockedIn = lastGlobalPunch?.punch_type === 'clock_in'

    return NextResponse.json({ punches: punches ?? [], isClockedIn, lastPunch })
  } catch (e) {
    return apiError(e)
  }
}
