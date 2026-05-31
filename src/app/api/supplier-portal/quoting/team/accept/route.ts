import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

    const { data: member } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, email, name, portal_account_id')
      .eq('invite_token', token)
      .is('accepted_at', null)
      .single()

    if (!member) return NextResponse.json({ error: 'Invalid or already-used invite link' }, { status: 404 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('company_name')
      .eq('id', member.portal_account_id)
      .single()

    // Check if this email already has an auth account — if so, no password setup needed
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = existingUsers?.users.find(u => u.email?.toLowerCase() === member.email.toLowerCase())

    return NextResponse.json({
      email: member.email,
      name: member.name,
      company: account?.company_name ?? '',
      existingAccount: !!existingUser,
    })
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json() as { token: string; password?: string }
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const { data: member } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, email, auth_user_id')
      .eq('invite_token', token)
      .is('accepted_at', null)
      .single()

    if (!member) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })

    let authUserId: string

    if (member.auth_user_id) {
      // Already linked — just mark accepted, never change their password
      authUserId = member.auth_user_id
    } else {
      // Check if an auth account already exists for this email
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = existingUsers?.users.find(u => u.email?.toLowerCase() === member.email.toLowerCase())

      if (existingUser) {
        // Link existing account — do NOT touch their password
        authUserId = existingUser.id
      } else {
        // New user — create account with the password they set
        if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 })
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password,
          email_confirm: true,
        })
        if (createErr || !created.user) {
          return NextResponse.json({ error: createErr?.message ?? 'Failed to create account' }, { status: 500 })
        }
        authUserId = created.user.id
      }
    }

    await supabaseAdmin
      .from('portal_org_members')
      .update({
        auth_user_id: authUserId,
        invite_token: null,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', member.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
