import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Request-scoped auth/org lookups.
 *
 * The layout and the page it renders both need the user, the org id and the
 * org's plan, and Next renders them concurrently — so without memoisation each
 * one costs a separate Supabase round trip per render pass. React's cache()
 * dedupes them within a single request: the first caller does the work, the
 * rest await the same promise.
 *
 * These are per-request only. Nothing is cached across requests, so a user
 * whose membership or plan changes sees it on their next page load.
 */

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentOrgId = cache(async () => {
  const supabase = await createClient()
  // Pending invites must be accepted before the org lookup, otherwise a freshly
  // invited user resolves to no org and gets bounced to onboarding.
  await supabase.rpc('accept_org_invite')
  const { data } = await supabase.rpc('get_current_org_id')
  return (data as string | null) ?? null
})

/** Plan + subscription state. Read through the admin client, scoped to the one org. */
export const getCurrentOrg = cache(async (orgId: string) => {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('plan, subscription_status, trial_ends_at')
    .eq('id', orgId)
    .single()
  return data
})
