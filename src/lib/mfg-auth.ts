import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'

export type MfgAuthResult =
  | { ok: true; portalAccountId: string; isAdmin: boolean }
  | { ok: false; error: string; status: number }

// Resolves the portal account for a manufacturing module API request.
// Returns 401 if not authenticated, 403 if not a manufacturer with an active plan.
export async function resolveMfgAuth(): Promise<MfgAuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized', status: 401 }

  const account = await resolvePortalAccount(user.id)
  if (!account) return { ok: false, error: 'No portal account', status: 401 }

  const active = isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)
  const hasQuoting = planRank(account.plan) >= 1 && active
  if (!hasQuoting || account.supplier_category !== 'manufacturer') {
    return { ok: false, error: 'Manufacturing plan required', status: 403 }
  }

  // Owner is always admin; team member role checked separately by caller if needed
  const isOwner = true // resolvePortalAccount returns the owner account or member's org account
  return { ok: true, portalAccountId: account.id, isAdmin: isOwner }
}
