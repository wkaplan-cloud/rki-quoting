import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getAdminMembership(userId: string) {
  const { data } = await supabaseAdmin
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data?.role === 'admin' ? data : null
}

// PATCH — update status (deactivate / reactivate)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getAdminMembership(user.id)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status, role } = await req.json()
  if (!id || (!status && !role)) return NextResponse.json({ error: 'id and status or role required' }, { status: 400 })

  // Block reactivation if the org is on Solo plan and already has a member
  if (status === 'active') {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('plan, subscription_status')
      .eq('id', membership.org_id)
      .single()
    if (org?.plan === 'solo' && org?.subscription_status === 'active') {
      const { count } = await supabaseAdmin
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', membership.org_id)
        .eq('status', 'active')
      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: 'Solo plan is limited to 1 user. Upgrade to Studio to reactivate team members.', upgrade: true }, { status: 403 })
      }
    }
  }

  const updates: Record<string, string> = {}
  if (status) updates.status = status
  if (role) updates.role = role

  const { error } = await supabaseAdmin
    .from('org_members')
    .update(updates)
    .eq('id', id)
    .eq('org_id', membership.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a member or cancel a pending invite
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getAdminMembership(user.id)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Fetch the member first so we can clean up their auth user if still pending
  const { data: member } = await supabaseAdmin
    .from('org_members')
    .select('user_id, status')
    .eq('id', id)
    .eq('org_id', membership.org_id)
    .maybeSingle()

  const { error } = await supabaseAdmin
    .from('org_members')
    .delete()
    .eq('id', id)
    .eq('org_id', membership.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If invite was pending, delete the auth user so the email can be re-invited
  if (member?.status === 'pending' && member.user_id) {
    await supabaseAdmin.auth.admin.deleteUser(member.user_id)
  }

  return NextResponse.json({ ok: true })
}
