import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function resolveStaff(userId: string) {
  const { data } = await supabaseAdmin
    .from('elec_staff')
    .select('id, portal_account_id, is_active')
    .eq('auth_user_id', userId)
    .single()
  if (!data || !data.is_active) return null
  return data
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staff = await resolveStaff(user.id)
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 403 })

    const search = req.nextUrl.searchParams.get('q') ?? ''
    let query = supabaseAdmin
      .from('elec_clients')
      .select('id, client_name, company, email')
      .eq('portal_account_id', staff.portal_account_id)
      .order('client_name', { ascending: true })

    if (search) {
      query = query.ilike('client_name', `%${search}%`)
    }

    const { data, error } = await query.limit(50)
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const staff = await resolveStaff(user.id)
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 403 })

    const { client_name } = await req.json() as { client_name: string }
    if (!client_name?.trim()) return NextResponse.json({ error: 'client_name required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('elec_clients')
      .insert({ portal_account_id: staff.portal_account_id, client_name: client_name.trim() })
      .select('id, client_name, company, email')
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) { return apiError(e) }
}
