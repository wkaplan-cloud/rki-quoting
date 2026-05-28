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
  if (adminId) return { accountId: adminId, staffId: null }
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('id, portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) return { accountId: staff.portal_account_id, staffId: staff.id }
  return { accountId: null, staffId: null }
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

    const { accountId } = await resolveAccountOrStaff(user.id)
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
