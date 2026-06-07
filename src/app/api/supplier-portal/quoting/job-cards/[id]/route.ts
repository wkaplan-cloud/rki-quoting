import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function resolveAccount(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return own.id
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  return mem?.portal_account_id ?? null
}

// Also allow staff to access their own job cards
async function resolveAccountOrStaff(userId: string) {
  const adminId = await resolveAccount(userId)
  if (adminId) return { accountId: adminId, staffId: null as string | null, staffName: null as string | null }
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('id, name, portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) return { accountId: staff.portal_account_id, staffId: staff.id, staffName: staff.name }
  return { accountId: null, staffId: null as string | null, staffName: null as string | null }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { accountId } = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('elec_job_cards')
      .select(`*, staff:elec_staff(id,name,color,role,phone,email), client:elec_clients(id,client_name,email,contact_number)`)
      .eq('id', id)
      .eq('portal_account_id', accountId)
      .single()
    if (error) throw error

    const { data: materials } = await supabaseAdmin
      .from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at')
    const { data: photos } = await supabaseAdmin
      .from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at')

    return NextResponse.json({ ...data, materials: materials ?? [], photos: photos ?? [] })
  } catch (e) { return apiError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { accountId, staffId, staffName } = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const body = await req.json() as Record<string, unknown>

    const { data, error } = await supabaseAdmin
      .from('elec_job_cards')
      .update(body)
      .eq('id', id)
      .eq('portal_account_id', accountId)
      .select()
      .single()
    if (error) throw error

    // Auto clock-out any staff still on-site when job is completed
    if (body.status === 'completed') {
      const { data: punches } = await supabaseAdmin
        .from('elec_time_punches')
        .select('staff_id, punch_type')
        .eq('portal_account_id', accountId)
        .eq('job_id', id)
        .order('punched_at', { ascending: true })

      if (punches && punches.length > 0) {
        // Find the last punch per staff — if it's clock_in, they're still on site
        const lastPunch: Record<string, string> = {}
        for (const p of punches) lastPunch[p.staff_id] = p.punch_type

        const stillOnSite = Object.entries(lastPunch)
          .filter(([, type]) => type === 'clock_in')
          .map(([staffId]) => staffId)

        if (stillOnSite.length > 0) {
          const now = new Date().toISOString()
          await supabaseAdmin.from('elec_time_punches').insert(
            stillOnSite.map(sid => ({
              portal_account_id: accountId,
              staff_id: sid,
              job_id: id,
              punch_type: 'clock_out',
              punched_at: now,
              notes: 'Auto clocked-out — job completed',
            }))
          )
        }
      }
    }

    // Notify admin when staff updates status
    if (staffId && body.status) {
      const isComplete = body.status === 'completed'
      supabaseAdmin.from('elec_notifications').insert({
        portal_account_id: accountId,
        type: isComplete ? 'job_completed' : 'job_card_updated',
        title: isComplete
          ? `Job completed — ${staffName ?? 'staff'}`
          : `Job card updated by ${staffName ?? 'staff'}`,
        body: isComplete
          ? (data.title ? `"${data.title}" marked as complete` : 'Job marked as complete')
          : `Status changed to "${body.status}"${data.title ? ` on "${data.title}"` : ''}`,
        metadata: { job_card_id: id, staff_id: staffId, status: body.status },
      })
    }

    // Notify admin when signature is captured
    if (staffId && body.client_signature_url) {
      supabaseAdmin.from('elec_notifications').insert({
        portal_account_id: accountId,
        type: 'signature_captured',
        title: `Signature captured — ${staffName ?? 'staff'}`,
        body: data.title ? `Client signed off on "${data.title}"` : 'Client signature captured',
        metadata: { job_card_id: id, staff_id: staffId },
      })
    }

    // Sync email and address back to the client record when present
    const clientId = typeof body.client_id === 'string' ? body.client_id : data.client_id
    if (clientId) {
      const clientPatch: Record<string, string> = {}
      if (typeof body.client_email === 'string' && body.client_email.trim())
        clientPatch.email = body.client_email.trim()
      if (typeof body.location === 'string' && body.location.trim())
        clientPatch.address = body.location.trim()
      if (Object.keys(clientPatch).length > 0)
        await supabaseAdmin.from('elec_clients').update(clientPatch).eq('id', clientId)
    }

    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccount(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    await supabaseAdmin.from('elec_job_cards').delete().eq('id', id).eq('portal_account_id', accountId)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
