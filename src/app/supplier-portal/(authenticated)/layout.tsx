import { redirect } from 'next/navigation'
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

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email, plan, subscription_status')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  // Count pending assignments (items this supplier still needs to price)
  const { data: sessionSuppliers } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id')
    .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)

  const ssIds = (sessionSuppliers ?? []).map((s: any) => s.id)

  let pendingCount = 0
  if (ssIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('id', { count: 'exact', head: true })
      .in('session_supplier_id', ssIds)
      .eq('status', 'pending')
    pendingCount = count ?? 0
  }

  const displayName = account.company_name ?? account.email
  const hasQuoting = account.plan === 'quoting' && account.subscription_status === 'active'

  return (
    <SupplierPortalShell companyName={displayName} pendingCount={pendingCount} hasQuoting={hasQuoting}>
      {children}
    </SupplierPortalShell>
  )
}
