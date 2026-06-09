export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgInvoicesClient } from './MfgInvoicesClient'

export default async function MfgInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')
  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const { data: invoices } = await supabase
    .from('mfg_invoices')
    .select('*, job:mfg_jobs(id, job_name, client:mfg_clients(id, client_name, email))')
    .eq('portal_account_id', account.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Invoices</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Track payments and manage outstanding invoices.</p>
      </div>
      <MfgInvoicesClient initialInvoices={invoices ?? []} />
    </div>
  )
}
