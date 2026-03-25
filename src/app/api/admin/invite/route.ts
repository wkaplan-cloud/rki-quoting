import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check caller is an admin (use admin client to bypass RLS, same as admin page)
  const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membership?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Create pending org_members record
  const { error: memberError } = await supabaseAdmin
    .from('org_members')
    .insert({
      org_id: membership.org_id,
      invited_email: email.toLowerCase(),
      role: role ?? 'designer',
      status: 'pending',
    })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Send invite email via Supabase Auth
  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
