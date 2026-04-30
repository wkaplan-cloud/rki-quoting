export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDashboard } from './SourcingDashboard'

export default async function SourcingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: sessions }, { data: clients }] = await Promise.all([
    supabase
      .from('sourcing_sessions')
      .select('id, title, status, archived, created_at, project_id, project:projects(project_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, client_name')
      .order('client_name', { ascending: true })
      .limit(200),
  ])

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

  // Build O(1) lookup maps before iterating sessions — avoids O(n²) .filter inside .map
  const itemCountMap = new Map<string, number>()
  const supplierCountMap = new Map<string, number>()
  for (const i of (itemCounts ?? [])) {
    itemCountMap.set((i as any).session_id, (itemCountMap.get((i as any).session_id) ?? 0) + 1)
  }
  for (const ss of (supplierCounts ?? [])) {
    supplierCountMap.set((ss as any).session_id, (supplierCountMap.get((ss as any).session_id) ?? 0) + 1)
  }

  const enriched = (sessions ?? []).map(s => {
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    return {
      id: s.id,
      title: s.title,
      status: s.status as string,
      archived: s.archived as boolean,
      created_at: s.created_at as string,
      project_name: (project as any)?.project_name ?? null,
      item_count: itemCountMap.get(s.id) ?? 0,
      supplier_count: supplierCountMap.get(s.id) ?? 0,
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
        <SourcingDashboard sessions={enriched} clients={(clients ?? []) as { id: string; client_name: string }[]} />
      </div>
    </div>
  )
}
