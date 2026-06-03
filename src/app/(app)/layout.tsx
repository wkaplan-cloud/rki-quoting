export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

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
    // Supplier portal accounts share the same Supabase auth but have no org — send them home
    const { data: supplierAccount } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    redirect(supplierAccount ? '/supplier-portal/dashboard' : '/onboarding')
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

  const [{ data: membership }, { data: settings }, { data: sourcingBadgeData }, { count: capitalBadgeCount }] = await Promise.all([
    supabaseAdmin.from('org_members').select('role, full_name').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('settings').select('business_name, capital_hotels_enabled').eq('org_id', orgId).maybeSingle(),
    orgId
      ? supabaseAdmin.rpc('get_sourcing_badge_count', { p_org_id: orgId })
      : Promise.resolve({ data: 0, error: null }),
    orgId
      ? supabaseAdmin.from('capital_requests').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending')
      : Promise.resolve({ count: 0, error: null }),
  ])

  // Sourcing badge: supplier responses waiting for designer to review
  const sourcingBadge = (sourcingBadgeData as number) ?? 0
  const capitalHotelsEnabled = settings?.capital_hotels_enabled ?? false
  const capitalBadge = capitalBadgeCount ?? 0

  return (
    <AppLayout
      isAdmin={membership?.role === 'admin'}
      businessName={settings?.business_name ?? ''}
      sourcingEnabled={true}
      sourcingBadge={sourcingBadge}
      capitalHotelsEnabled={capitalHotelsEnabled}
      capitalBadge={capitalBadge}
      userEmail={user.email ?? ''}
      userName={membership?.full_name ?? ''}
      plan={org?.plan ?? 'trial'}
      subscriptionStatus={org?.subscription_status ?? 'trialing'}
      trialDaysLeft={trialDaysLeft}
      trialExpired={trialExpired}
      graceDaysLeft={graceDaysLeft}
    >
      {children}
    </AppLayout>
  )
}
