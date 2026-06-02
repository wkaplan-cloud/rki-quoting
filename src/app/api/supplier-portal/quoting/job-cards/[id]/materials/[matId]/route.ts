import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function resolveAccountOrStaff(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return own.id
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) return mem.portal_account_id
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  return staff?.portal_account_id ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; matId: string }> }) {
  try {
    const { id, matId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data: mat } = await supabaseAdmin
      .from('elec_job_card_materials')
      .select('id, elec_job_cards!inner(portal_account_id)')
      .eq('id', matId)
      .eq('job_card_id', id)
      .maybeSingle()
    if (!mat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { description?: string; qty?: number; unit_price?: number | null; cost_price?: number | null }
    const patch: Record<string, string | number | null> = {}
    if (body.description !== undefined) patch.description = body.description
    if (body.qty          !== undefined) patch.qty         = body.qty
    if (body.unit_price   !== undefined) patch.unit_price  = body.unit_price
    if (body.cost_price   !== undefined) patch.cost_price  = body.cost_price

    const { data: updated } = await supabaseAdmin
      .from('elec_job_card_materials')
      .update(patch)
      .eq('id', matId)
      .select()
      .single()

    return NextResponse.json({ ok: true, material: updated })
  } catch (e) { return apiError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; matId: string }> }) {
  try {
    const { id, matId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    // Verify the material belongs to a job card in this account
    const { data: mat } = await supabaseAdmin
      .from('elec_job_card_materials')
      .select('id, elec_job_cards!inner(portal_account_id)')
      .eq('id', matId)
      .eq('job_card_id', id)
      .maybeSingle()
    if (!mat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabaseAdmin.from('elec_job_card_materials').delete().eq('id', matId)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
