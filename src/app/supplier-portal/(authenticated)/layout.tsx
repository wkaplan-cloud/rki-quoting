import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierPortalNav } from './SupplierPortalNav'

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
    .select('id, company_name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

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

  return (
    <div className="flex min-h-screen" style={{ background: '#F4F4F5' }}>
      <SupplierPortalNav
        companyName={displayName}
        pendingCount={pendingCount}
      />
      <main className="md:ml-12 flex-1 pt-14 md:pt-0">
        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
