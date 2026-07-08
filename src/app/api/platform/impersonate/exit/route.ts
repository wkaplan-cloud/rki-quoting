import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { IMPERSONATION_COOKIE, getImpersonationStash } from '@/lib/impersonation'

// POST /api/platform/impersonate/exit — restores the platform admin's own session
export async function POST() {
  const stash = await getImpersonationStash()
  const cookieStore = await cookies()

  if (!stash) {
    return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.setSession({
    access_token: stash.adminAccessToken,
    refresh_token: stash.adminRefreshToken,
  })

  cookieStore.delete(IMPERSONATION_COOKIE)

  await supabaseAdmin.from('audit_logs').insert({
    org_id: stash.orgId,
    project_id: null,
    user_email: stash.adminEmail,
    action: 'impersonation_ended',
    table_name: 'org_members',
    record_id: stash.targetUserId,
    old_data: null,
    new_data: { impersonated_email: stash.targetEmail, org_name: stash.orgName, restored: !error },
  })

  if (error) {
    // Stashed admin session could not be restored (e.g. refresh token already rotated) —
    // sign out fully rather than leaving the browser on a half-restored session.
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true, redirectTo: '/login?error=session_expired' })
  }

  return NextResponse.json({ ok: true, redirectTo: '/platform/studios' })
}
