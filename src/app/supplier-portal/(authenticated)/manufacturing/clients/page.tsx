export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgClientsClient } from './MfgClientsClient'
import type { MfgClient } from '@/lib/mfg-types'

export default async function MfgClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')
  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const { data: clients } = await supabase
    .from('mfg_clients')
    .select('*')
    .eq('portal_account_id', account.id)
    .is('archived_at', null)
    .order('client_name')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Clients</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Your client directory. Jobs and quotes live under each client.</p>
      </div>
      <MfgClientsClient initialClients={(clients ?? []) as MfgClient[]} />
    </div>
  )
}
