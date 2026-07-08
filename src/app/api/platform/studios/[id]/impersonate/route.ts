import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { IMPERSONATION_COOKIE, ImpersonationStash } from '@/lib/impersonation'

// POST /api/platform/studios/[id]/impersonate — starts a platform-admin impersonation session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params
  if (!orgId) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || !session?.refresh_token) {
    return NextResponse.json({ error: 'No active session to restore afterwards' }, { status: 400 })
  }

  const [{ data: org }, { data: adminMember }] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
    supabaseAdmin.from('org_members').select('id, user_id, invited_email, full_name').eq('org_id', orgId).eq('role', 'admin').eq('status', 'active').maybeSingle(),
  ])
  if (!org) return NextResponse.json({ error: 'Studio not found' }, { status: 404 })
  if (!adminMember?.invited_email) {
    return NextResponse.json({ error: 'No active admin found for this studio' }, { status: 400 })
  }

  const { data: settings } = await supabaseAdmin.from('settings').select('business_name').eq('org_id', orgId).maybeSingle()
  const orgName = settings?.business_name || org.name

  // Derive from the actual incoming request, not an env var that may not match
  // the host currently being tested (e.g. a Vercel preview URL) — a mismatch here
  // sends the magic link to the wrong domain, where a stale admin session can mask
  // the failure by silently landing back on the platform admin's own dashboard.
  //
  // Points at /auth/impersonate-callback (a client page), not /auth/callback (a server
  // route): admin.generateLink's magiclink redirect carries the session as a URL hash
  // fragment, which never reaches the server — it must be picked up client-side.
  const baseUrl = req.nextUrl.origin
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: adminMember.invited_email,
    options: { redirectTo: `${baseUrl}/auth/impersonate-callback` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: 'Failed to generate impersonation session' }, { status: 500 })
  }

  const stash: ImpersonationStash = {
    adminEmail: user.email!,
    adminAccessToken: session.access_token,
    adminRefreshToken: session.refresh_token,
    orgId,
    orgName,
    targetEmail: adminMember.invited_email,
    targetUserId: adminMember.user_id,
    startedAt: new Date().toISOString(),
  }

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(stash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600,
    path: '/',
  })

  await supabaseAdmin.from('audit_logs').insert({
    org_id: orgId,
    project_id: null,
    user_email: user.email,
    action: 'impersonation_started',
    table_name: 'org_members',
    record_id: adminMember.id,
    old_data: null,
    new_data: { impersonated_user_id: adminMember.user_id, impersonated_email: adminMember.invited_email, org_name: orgName },
  })

  return NextResponse.json({ signInUrl: linkData.properties.action_link })
}
