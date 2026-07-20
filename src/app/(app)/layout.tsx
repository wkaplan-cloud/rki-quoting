export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { SessionExpiredHandler } from '@/components/SessionExpiredHandler'
import { resolvePortalAccount } from '@/lib/portal-account'
import { getImpersonationStash } from '@/lib/impersonation'

const GRACE_DAYS = 3

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Accept invite and get user in parallel — both only need the session cookie
  const [{ data: { user } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('accept_org_invite'),
  ])
  if (!user) redirect('/login')

  // get_current_org_id must run after accept_org_invite completes
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  if (!orgId) {
    if (user.email?.toLowerCase() === process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
      redirect('/platform')
    }
    // resolvePortalAccount checks supplier_portal_accounts (owners) + portal_org_members (members)
    const portalAccount = await resolvePortalAccount(user.id)
    if (portalAccount) redirect('/supplier-portal/home')

    // Electrician / trades staff have no portal account — send to staff home
    const { data: staffMember } = await supabaseAdmin
      .from('elec_staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    redirect(staffMember ? '/supplier-portal/staff-home' : '/onboarding')
  }

  // Check subscription / trial status
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', orgId)
    .single()

  // Calculate trial and grace period
  const now = new Date()
  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null
  const gracePeriodEndsAt = trialEndsAt ? new Date(trialEndsAt.getTime() + GRACE_DAYS * 86400000) : null

  const isActive = org?.subscription_status === 'active'
  const isTrialing = org?.subscription_status === 'trialing'
  const isCancelled = org?.subscription_status === 'cancelled'
  const trialExpired = isTrialing && trialEndsAt !== null && trialEndsAt < now
  const gracePeriodOver = trialExpired && gracePeriodEndsAt !== null && gracePeriodEndsAt < now

  // Lock access: not active AND (grace period is over OR cancelled)
  if (!isActive && (gracePeriodOver || isCancelled)) {
    redirect('/subscribe')
  }

  // Grace days remaining (shown in banner after trial expires)
  const graceDaysLeft = trialExpired && gracePeriodEndsAt
    ? Math.max(0, Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / 86400000))
    : null

  // Days left in trial (before expiry)
  const trialDaysLeft =
    !trialExpired && trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : null

  const [{ data: membership }, { data: settings }, { count: capitalBadgeCount }] = await Promise.all([
    supabaseAdmin.from('org_members').select('role, full_name').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('settings').select('business_name, capital_hotels_enabled, studio_enabled').eq('org_id', orgId).maybeSingle(),
    orgId
      ? supabaseAdmin.from('capital_requests').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending').eq('archived', false)
      : Promise.resolve({ count: 0, error: null }),
  ])

  const capitalHotelsEnabled = settings?.capital_hotels_enabled ?? false
  const studioEnabled = settings?.studio_enabled ?? false
  const capitalBadge = capitalBadgeCount ?? 0

  // Only trust the impersonation stash if it actually matches who's currently logged in —
  // guards against a stale cookie surviving a normal (non-impersonated) login as the same user.
  const impersonationStash = await getImpersonationStash()
  const impersonation = impersonationStash && impersonationStash.targetUserId === user.id
    ? { targetEmail: impersonationStash.targetEmail, orgName: impersonationStash.orgName, adminEmail: impersonationStash.adminEmail }
    : null

  return (
    <AppLayout
      isAdmin={membership?.role === 'admin'}
      businessName={settings?.business_name ?? ''}
      capitalHotelsEnabled={capitalHotelsEnabled}
      capitalBadge={capitalBadge}
      studioEnabled={studioEnabled}
      userEmail={user.email ?? ''}
      userName={membership?.full_name ?? ''}
      plan={org?.plan ?? 'trial'}
      subscriptionStatus={org?.subscription_status ?? 'trialing'}
      trialDaysLeft={trialDaysLeft}
      trialExpired={trialExpired}
      graceDaysLeft={graceDaysLeft}
      impersonation={impersonation}
    >
      <SessionExpiredHandler loginPath="/login" />
      {children}
    </AppLayout>
  )
}
