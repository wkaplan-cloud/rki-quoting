import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierPortalShell } from './SupplierPortalShell'

export default async function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  // Fire owner lookup + admin-member-with-account join in parallel — eliminates the
  // previous sequential third query that admin members incurred
  const [{ data: ownerAccount }, { data: membership }] = await Promise.all([
    supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, company_name, email, plan, subscription_status, trial_ends_at, supplier_category')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('portal_org_members')
      .select('portal_account_id, account:supplier_portal_accounts(id, company_name, email, plan, subscription_status, trial_ends_at, supplier_category)')
      .eq('auth_user_id', user.id)
      .not('accepted_at', 'is', null)
      .maybeSingle(),
  ])

  const memberAccount = membership
    ? (Array.isArray((membership as any).account) ? (membership as any).account[0] : (membership as any).account)
    : null

  let account = ownerAccount ?? memberAccount

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
  const isTrialing = account.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  const hasQuoting = account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing)

  const pathname = (await headers()).get('x-pathname') ?? ''
  const isTrades = account.supplier_category === 'trades'
  const upgradeExempt = pathname.startsWith('/supplier-portal/upgrade') || pathname.startsWith('/supplier-portal/profile')
  if (isTrades && !hasQuoting && !upgradeExempt) {
    redirect('/supplier-portal/upgrade')
  }

  return (
    <SupplierPortalShell companyName={displayName} hasQuoting={hasQuoting}>
      {children}
    </SupplierPortalShell>
  )
}
