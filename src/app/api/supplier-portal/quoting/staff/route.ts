import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { hashStaffPin, staffAuthEmail, staffAuthPassword } from '@/lib/staff-auth'
import { resolvePortalAccount } from '@/lib/portal-account'
export { hashStaffPin, staffAuthEmail, staffAuthPassword }

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data } = await supabaseAdmin
      .from('elec_staff')
      .select('*')
      .eq('portal_account_id', account.id)
      .order('created_at')

    return NextResponse.json(data ?? [])
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json()
    const { name, role, phone, color, username, pin } = body

    if (!username?.trim()) return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    if (!pin || !/^\d{4}$/.test(String(pin))) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })

    const usernameClean = username.toLowerCase().trim()

    // Enforce globally unique usernames across all staff
    const { data: existing } = await supabaseAdmin
      .from('elec_staff')
      .select('id')
      .eq('username', usernameClean)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })

    // Insert staff record first
    const { data: staff, error: insertError } = await supabaseAdmin
      .from('elec_staff')
      .insert({
        portal_account_id: account.id,
        name,
        role,
        phone: phone || null,
        color,
        username: usernameClean,
        pin_hash: hashStaffPin(String(pin)),
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    // Create Supabase auth user for this staff member
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: staffAuthEmail(usernameClean),
      password: staffAuthPassword(String(pin)),
      email_confirm: true,
    })

    if (authError || !authData.user) {
      await supabaseAdmin.from('elec_staff').delete().eq('id', staff.id)
      return NextResponse.json({ error: authError?.message ?? 'Failed to create auth account' }, { status: 400 })
    }

    // Link auth user
    const { data: updated } = await supabaseAdmin
      .from('elec_staff')
      .update({ auth_user_id: authData.user.id })
      .eq('id', staff.id)
      .select()
      .single()

    return NextResponse.json(updated)
  } catch (e) {
    return apiError(e)
  }
}
