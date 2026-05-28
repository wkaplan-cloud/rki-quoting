import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json() as { token: string; password: string }
    if (!token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, email, invite_token, invite_sent_at, auth_user_id')
      .eq('invite_token', token)
      .single()

    if (!staff) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
    if (!staff.email) return NextResponse.json({ error: 'No email on staff record' }, { status: 400 })

    // Check expiry
    if (staff.invite_sent_at) {
      const sent = new Date(staff.invite_sent_at)
      if ((Date.now() - sent.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Invite link expired' }, { status: 410 })
      }
    }

    let authUserId: string

    if (staff.auth_user_id) {
      // Already has an account — update password
      await supabaseAdmin.auth.admin.updateUserById(staff.auth_user_id, { password })
      authUserId = staff.auth_user_id
    } else {
      // Create new auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: staff.email,
        password,
        email_confirm: true,
      })
      if (createErr || !created.user) {
        // User might already exist with this email
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existing.users.find(u => u.email === staff.email)
        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password })
          authUserId = existingUser.id
        } else {
          return NextResponse.json({ error: createErr?.message ?? 'Failed to create account' }, { status: 500 })
        }
      } else {
        authUserId = created.user.id
      }
    }

    await supabaseAdmin
      .from('elec_staff')
      .update({
        auth_user_id: authUserId,
        invite_token: null,
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('id', staff.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
