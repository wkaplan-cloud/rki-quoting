export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

const GRACE_DAYS = 3

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Try to accept any pending invite first (security definer bypasses RLS)
  await supabase.rpc('accept_org_invite')

  // Check org membership via RPC (security definer — bypasses RLS circular dependency)
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  if (!orgId) redirect('/onboarding')

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

  const [{ data: membership }, { data: settings }, { data: member }] = await Promise.all([
    supabaseAdmin.from('org_members').select('role').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('settings').select('business_name, sourcing_enabled').maybeSingle(),
    supabaseAdmin.from('org_members').select('full_name').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  // Sourcing badge: supplier responses waiting for designer to review
  let sourcingBadge = 0
  if (settings?.sourcing_enabled && orgId) {
    const { data: activeSessions } = await supabaseAdmin
      .from('sourcing_sessions')
      .select('id')
      .eq('org_id', orgId)
      .neq('status', 'archived')

    const sessionIds = (activeSessions ?? []).map((s: any) => s.id)

    if (sessionIds.length > 0) {
      const { data: ssRows } = await supabaseAdmin
        .from('sourcing_session_suppliers')
        .select('id')
        .in('session_id', sessionIds)

      const ssIds = (ssRows ?? []).map((s: any) => s.id)

      if (ssIds.length > 0) {
        const { count: respondedCount } = await supabaseAdmin
          .from('sourcing_item_assignments')
          .select('id', { count: 'exact', head: true })
          .in('session_supplier_id', ssIds)
          .eq('status', 'responded')
        sourcingBadge = respondedCount ?? 0
      }
    }
  }

  return (
    <AppLayout
      isAdmin={membership?.role === 'admin'}
      businessName={settings?.business_name ?? ''}
      sourcingEnabled={settings?.sourcing_enabled ?? false}
      sourcingBadge={sourcingBadge}
      userEmail={user.email ?? ''}
      userName={member?.full_name ?? ''}
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
