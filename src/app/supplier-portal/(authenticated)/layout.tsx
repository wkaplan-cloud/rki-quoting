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

  // Check portal account exists
  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) {
    redirect('/supplier-portal/login')
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <SupplierPortalNav companyName={portalAccount.company_name ?? portalAccount.email} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
