export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDashboard } from './SourcingDashboard'

export default async function SourcingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('sourcing_enabled')
    .maybeSingle()

  if (!settings?.sourcing_enabled) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('sourcing_sessions')
    .select('id, title, status, archived, created_at, project_id, project:projects(project_name)')
    .order('created_at', { ascending: false })

  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_name')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch item + supplier counts per session
  const ids = (sessions ?? []).map(s => s.id)

  const [{ data: itemCounts }, { data: supplierCounts }] = await Promise.all(
    ids.length > 0
      ? [
          supabase.from('sourcing_session_items').select('session_id').in('session_id', ids),
          supabase.from('sourcing_session_suppliers').select('session_id, status').in('session_id', ids),
        ]
      : [{ data: [] }, { data: [] }]
  )

  const enriched = (sessions ?? []).map(s => {
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    return {
      id: s.id,
      title: s.title,
      status: s.status as string,
      archived: s.archived as boolean,
      created_at: s.created_at as string,
      project_name: (project as any)?.project_name ?? null,
      item_count: (itemCounts ?? []).filter((i: any) => i.session_id === s.id).length,
      supplier_count: (supplierCounts ?? []).filter((ss: any) => ss.session_id === s.id).length,
    }
  })

  const active = enriched.filter(s => !s.archived)

  return (
    <div>
      <PageHeader
        title="Price Requests"
        subtitle={`${active.length} active price request${active.length !== 1 ? 's' : ''}`}
      />
      <div className="p-6 lg:p-8">
        <SourcingDashboard sessions={enriched} projects={(projects ?? []) as { id: string; project_name: string }[]} />
      </div>
    </div>
  )
}
