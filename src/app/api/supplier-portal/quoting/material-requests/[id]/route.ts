import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

async function getPortalAccountId(userId: string): Promise<string | null> {
  const account = await resolvePortalAccount(userId)
  if (account) return account.id
  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('portal_account_id')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return staff?.portal_account_id ?? null
}

// PATCH /api/supplier-portal/quoting/material-requests/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const portalAccountId = await getPortalAccountId(user.id)
    if (!portalAccountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const body = await req.json() as {
      status?: string
      supplier?: string
      notes?: string
      description?: string
      qty?: number
      unit?: string
    }

    const patch: Record<string, unknown> = {}
    if (body.status      !== undefined) patch.status   = body.status
    if (body.supplier    !== undefined) patch.supplier  = body.supplier
    if (body.notes       !== undefined) patch.notes     = body.notes
    if (body.description !== undefined) patch.description = body.description
    if (body.qty         !== undefined) patch.qty       = body.qty
    if (body.unit        !== undefined) patch.unit      = body.unit

    if (body.status === 'ordered')  patch.ordered_at  = new Date().toISOString()
    if (body.status === 'received') patch.received_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('elec_material_requests')
      .update(patch)
      .eq('id', id)
      .eq('portal_account_id', portalAccountId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}

// DELETE /api/supplier-portal/quoting/material-requests/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const portalAccountId = await getPortalAccountId(user.id)
    if (!portalAccountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { error } = await supabaseAdmin
      .from('elec_material_requests')
      .delete()
      .eq('id', id)
      .eq('portal_account_id', portalAccountId)

    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (e) { return apiError(e) }
}
