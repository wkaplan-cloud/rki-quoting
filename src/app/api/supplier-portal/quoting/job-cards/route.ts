import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveCreatorName } from '@/lib/resolve-creator'

async function resolveAccount(userId: string): Promise<{ accountId: string; staffId: string | null } | null> {
  // owner
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return { accountId: own.id, staffId: null }
  // additional admin
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) return { accountId: mem.portal_account_id, staffId: null }
  // staff member
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('id, portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) return { accountId: staff.portal_account_id, staffId: staff.id }
  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveAccount(user.id)
    if (!resolved) return NextResponse.json({ error: 'No account' }, { status: 403 })
    const { accountId } = resolved

    const { data, error } = await supabaseAdmin
      .from('elec_job_cards')
      .select(`*, staff:elec_staff(id,name,color,role), client:elec_clients(id,client_name,email)`)
      .eq('portal_account_id', accountId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveAccount(user.id)
    if (!resolved) return NextResponse.json({ error: 'No account' }, { status: 403 })
    const { accountId, staffId } = resolved

    const body = await req.json() as Record<string, unknown>

    // Auto-generate job number
    const { count } = await supabaseAdmin
      .from('elec_job_cards').select('*', { count: 'exact', head: true })
      .eq('portal_account_id', accountId)
    const num = String((count ?? 0) + 1).padStart(4, '0')
    const jobNumber = `JC-${num}`

    const createdByName = await resolveCreatorName(user.id)

    // Auto-assign staff_id when request comes from a staff member
    const insertData = {
      ...body,
      portal_account_id: accountId,
      job_number: jobNumber,
      created_by_name: createdByName,
      ...(staffId && !body.staff_id ? { staff_id: staffId } : {}),
    }

    const { data, error } = await supabaseAdmin
      .from('elec_job_cards')
      .insert(insertData)
      .select(`*, staff:elec_staff(id,name,color,role), client:elec_clients(id,client_name,email)`)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}
