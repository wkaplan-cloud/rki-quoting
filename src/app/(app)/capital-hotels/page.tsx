export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { CapitalHotelsClient } from './CapitalHotelsClient'

export default async function CapitalHotelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('capital_hotels_enabled')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.capital_hotels_enabled) redirect('/dashboard')

  const [{ data: requests }, { data: hotels }] = await Promise.all([
    supabase
      .from('capital_requests')
      .select('id, hotel_name, hotel_id, status, submitted_at, quote_project_id, capital_request_items(id)')
      .eq('archived', false)
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
