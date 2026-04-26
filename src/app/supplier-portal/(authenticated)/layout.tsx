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

  if (!user) {
    redirect('/supplier-portal/login')
  }

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) {
    redirect('/supplier-portal/login')
  }

  const displayName = portalAccount.company_name ?? portalAccount.email

  return (
    <div className="min-h-screen" style={{ background: '#F0F4F8' }}>
      <SupplierPortalNav companyName={displayName} />
      <div className="pl-56">
        <main className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
