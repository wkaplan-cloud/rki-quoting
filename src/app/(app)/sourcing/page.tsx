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
      .select('id, title, status, archived, created_at, project_id, project:projects(project_name), sourcing_session_items(count), sourcing_session_suppliers(count)')
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, client_name')
      .order('client_name', { ascending: true })
      .limit(200),
  ])

  const enriched = (sessions ?? []).map(s => {
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    return {
      id: s.id,
      title: s.title,
      status: s.status as string,
      archived: s.archived as boolean,
      created_at: s.created_at as string,
      project_name: (project as any)?.project_name ?? null,
      item_count: (s as any).sourcing_session_items?.[0]?.count ?? 0,
      supplier_count: (s as any).sourcing_session_suppliers?.[0]?.count ?? 0,
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
