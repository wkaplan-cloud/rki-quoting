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

  // Count unread designer messages (messages from designer they haven't seen yet)
  // Using a simple heuristic: messages from designer in the last 30 days
  let unreadMessages = 0
  if (ssIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('sourcing_thread_messages')
      .select('id', { count: 'exact', head: true })
      .in('session_supplier_id', ssIds)
      .eq('sender_type', 'designer')
    unreadMessages = count ?? 0
  }

  const displayName = account.company_name ?? account.email
  const totalBadge = pendingCount + unreadMessages

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <SupplierPortalNav
        companyName={displayName}
        pendingCount={totalBadge}
      />
      <div className="pl-56">
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
