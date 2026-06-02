export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { CapitalHotelsClient } from './CapitalHotelsClient'

export default async function CapitalHotelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Guard: only orgs with capital_hotels_enabled can access this
  const { data: settings } = await supabase
    .from('settings')
    .select('capital_hotels_enabled')
    .maybeSingle()

  if (!settings?.capital_hotels_enabled) redirect('/dashboard')

  const [{ data: requests }, { data: hotels }] = await Promise.all([
    supabase
      .from('capital_requests')
      .select('id, hotel_name, hotel_id, status, submitted_at, quote_project_id, capital_request_items(id)')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('capital_hotels')
      .select('id, name, active')
      .order('name'),
  ])

  return (
    <div>
      <PageHeader
        title="Capital Hotels"
        subtitle="Maintenance requests from The Capital Hotels"
      />
      <div className="p-6 lg:p-8">
        <CapitalHotelsClient
          initialRequests={requests ?? []}
          hotels={hotels ?? []}
        />
      </div>
    </div>
  )
}
