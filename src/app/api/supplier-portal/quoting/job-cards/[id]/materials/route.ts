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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const { data: card } = await supabaseAdmin
      .from('elec_job_cards').select('id').eq('id', id).eq('portal_account_id', accountId).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as { description: string; qty: number; unit_price?: number | null }

    const { data, error } = await supabaseAdmin
      .from('elec_job_card_materials')
      .insert({ job_card_id: id, description: body.description, qty: body.qty, unit_price: body.unit_price ?? null })
      .select().single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}
