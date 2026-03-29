export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

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
    .select('subscription_status, trial_ends_at')
    .eq('id', orgId)
    .single()

  if (org) {
    const isActive = org.subscription_status === 'active'
    const isTrialing = org.subscription_status === 'trialing'
    const trialExpired = isTrialing && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()
    const isCancelled = org.subscription_status === 'cancelled'
    if (!isActive && (trialExpired || isCancelled)) {
      redirect('/subscribe')
    }
  }

  const [{ data: membership }, { data: settings }, { data: member }] = await Promise.all([
    supabaseAdmin.from('org_members').select('role').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('settings').select('business_name').maybeSingle(),
    supabaseAdmin.from('org_members').select('full_name').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  return (
    <AppLayout
      isAdmin={membership?.role === 'admin'}
      businessName={settings?.business_name ?? ''}
      userEmail={user.email ?? ''}
      userName={member?.full_name ?? ''}
    >
      {children}
    </AppLayout>
  )
}
