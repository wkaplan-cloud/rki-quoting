import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { SupplierPortalShell } from './SupplierPortalShell'
import { isActivePlan, planRank } from '@/lib/plan-features'

export default async function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  let account = await resolvePortalAccount(user.id)

  // Staff member: redirect to staff view
  if (!account) {
    const { data: staffMember } = await supabaseAdmin
      .from('elec_staff')
      .select('id, portal_account_id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staffMember) redirect('/supplier-portal/staff-home')
    redirect('/supplier-portal/not-a-supplier')
  }

  const displayName = account.company_name ?? account.email
  const active = isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)
  const hasQuoting = planRank(account.plan) >= 1 && active

  const pathname = (await headers()).get('x-pathname') ?? ''
  const isTrades = account.supplier_category === 'trades'
  const upgradeExempt = pathname.startsWith('/supplier-portal/upgrade') || pathname.startsWith('/supplier-portal/profile')
  if (isTrades && !hasQuoting && !upgradeExempt) {
    redirect('/supplier-portal/upgrade')
  }

  return (
    <SupplierPortalShell
      companyName={displayName}
      hasQuoting={hasQuoting}
      quotingPlan={active ? (account.plan ?? null) : null}
      supplierCategory={account.supplier_category ?? 'manufacturer'}
    >
      {children}
    </SupplierPortalShell>
  )
}
