export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDashboard } from './SourcingDashboard'
import type { SourcingRequest } from '@/lib/types'

export default async function SourcingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('sourcing_enabled')
    .maybeSingle()

  if (!settings?.sourcing_enabled) redirect('/dashboard')

  const { data: requests } = await supabase
    .from('sourcing_requests')
    .select('*')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  // Fetch recipient counts per request
  const ids = (requests ?? []).map(r => r.id)
  const { data: recipients } = ids.length > 0
    ? await supabase
        .from('sourcing_request_recipients')
        .select('sourcing_request_id, status')
        .in('sourcing_request_id', ids)
    : { data: [] }

  return (
    <div>
      <PageHeader
        title="Request Price"
        subtitle={`${requests?.length ?? 0} request${requests?.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 lg:p-8">
        <SourcingDashboard
          requests={(requests ?? []) as SourcingRequest[]}
          recipients={recipients ?? []}
        />
      </div>
    </div>
  )
}
