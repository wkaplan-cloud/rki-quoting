import { cache } from 'react'
import { supabaseAdmin } from './supabase/admin'

export type PortalAccount = {
  id: string
  email: string
  company_name: string | null
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  supplier_category: string | null
  plan_category: string | null
  logo_url: string | null
  receive_price_requests: boolean
}

// Resolves the supplier portal account for a given auth user ID.
// Checks owner accounts first, then admin-member accounts via portal_org_members.
// Wrapped in React cache() so it deduplicates within a single server request —
// both the layout and each page.tsx can call this without extra DB round trips.
export const resolvePortalAccount = cache(async (userId: string): Promise<PortalAccount | null> => {
  const [{ data: ownerAccount }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email, company_name, plan, subscription_status, trial_ends_at, supplier_category, plan_category, logo_url, receive_price_requests')
      .eq('auth_user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('portal_org_members')
      .select('portal_account_id, account:supplier_portal_accounts(id, email, company_name, plan, subscription_status, trial_ends_at, supplier_category, plan_category, logo_url, receive_price_requests)')
      .eq('auth_user_id', userId)
      .not('accepted_at', 'is', null)
      .maybeSingle(),
  ])

  if (ownerAccount) return ownerAccount

  const memberAccount = membership
    ? (Array.isArray((membership as any).account) ? (membership as any).account[0] : (membership as any).account)
    : null

  return memberAccount ?? null
})

export type ResolvedAccount = { accountId: string; staffId: string | null; staffName: string | null }

// Resolves a portal_account_id for owner, org-member, OR elec_staff logins.
// Use this (instead of resolvePortalAccount) in any API route that staff-mobile
// sessions also need to call — resolvePortalAccount only covers owner/org-member.
export const resolveAccountOrStaff = cache(async (userId: string): Promise<ResolvedAccount | null> => {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return { accountId: own.id, staffId: null, staffName: null }

  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) return { accountId: mem.portal_account_id, staffId: null, staffName: null }

  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('id, name, portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) return { accountId: staff.portal_account_id, staffId: staff.id, staffName: staff.name }

  return null
})
