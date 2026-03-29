export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SubscribeClient } from './SubscribeClient'

export default async function SubscribePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/onboarding')

  // If already active, send back to app
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan, trial_ends_at, subscription_status')
    .eq('id', orgId)
    .single()

  if (org?.subscription_status === 'active') redirect('/dashboard')

  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : 0
  const trialExpired = daysLeft === 0

  return <SubscribeClient trialExpired={trialExpired} daysLeft={daysLeft} />
}
