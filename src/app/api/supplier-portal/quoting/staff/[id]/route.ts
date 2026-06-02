import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { hashStaffPin, staffAuthEmail, staffAuthPassword } from '@/lib/staff-auth'
import { resolvePortalAccount } from '@/lib/portal-account'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const body = await req.json()
    const { pin, username, ...rest } = body

    const dbUpdate: Record<string, unknown> = { ...rest }

    if (username !== undefined) {
      const usernameClean = username.toLowerCase().trim()
      // Check uniqueness (exclude this staff member)
      const { data: existing } = await supabaseAdmin
        .from('elec_staff')
        .select('id')
        .eq('username', usernameClean)
        .neq('id', id)
        .maybeSingle()
      if (existing) return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
      dbUpdate.username = usernameClean
    }

    if (pin !== undefined && pin !== '') {
      if (!/^\d{4}$/.test(String(pin))) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
      dbUpdate.pin_hash = hashStaffPin(String(pin))

      // Update Supabase auth password if staff has an auth user
      const { data: staff } = await supabaseAdmin
        .from('elec_staff')
        .select('auth_user_id, username')
        .eq('id', id)
        .single()

      if (staff?.auth_user_id) {
        const effectiveUsername = (username ?? staff.username) as string
        await supabaseAdmin.auth.admin.updateUserById(staff.auth_user_id, {
          email: staffAuthEmail(effectiveUsername),
          password: staffAuthPassword(String(pin)),
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('elec_staff')
      .update(dbUpdate)
      .eq('id', id)
      .eq('portal_account_id', account.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    // Also delete the Supabase auth user
    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('auth_user_id')
      .eq('id', id)
      .single()

    if (staff?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(staff.auth_user_id)
    }

    await supabaseAdmin
      .from('elec_staff')
      .delete()
      .eq('id', id)
      .eq('portal_account_id', account.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
