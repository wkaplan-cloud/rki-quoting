export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { HomeClient } from './HomeClient'

// Landing page for supplier accounts that are neither trades nor
// manufacturing. Sourcing/"Price Requests" used to live here — that's gone,
// pricing now happens through Studio (email + PDF), so there's nothing to
// query or list any more. This is just a simple landing spot.
export default async function SupplierHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const companyName = account.company_name ?? account.email

  if (account.supplier_category === 'trades') redirect('/supplier-portal/quoting/dashboard')

  const isManufacturing = account.plan_category === 'manufacturer'
  if (isManufacturing) redirect('/supplier-portal/manufacturing/dashboard')

  return <HomeClient companyName={companyName} />
}
