export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDashboard } from './SourcingDashboard'

export default async function SourcingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: sessions }, { data: clients }, { data: newResponseRows }] = await Promise.all([
    supabase
      .from('sourcing_sessions')
      .select('id, title, status, archived, created_at, project_id, request_number, user_id, project:projects(project_name), sourcing_session_items(count), sourcing_session_suppliers(count)')
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, client_name')
      .order('client_name', { ascending: true })
      .limit(200),
    supabase.rpc('get_session_new_response_counts', { p_user_id: user.id }),
  ])

  const newResponseMap: Record<string, number> = {}
  for (const row of newResponseRows ?? []) {
    newResponseMap[row.session_id] = Number(row.new_response_count)
  }

  // Resolve creator names from org_members
  const userIds = [...new Set((sessions ?? []).map(s => s.user_id).filter(Boolean))]
  let memberNames: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: members } = await supabase
      .from('org_members')
      .select('user_id, full_name')
      .in('user_id', userIds)
    for (const m of members ?? []) {
      if (m.user_id) memberNames[m.user_id] = m.full_name ?? ''
    }
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
      item_count: (s as any).sourcing_session_items?.[0]?.count ?? 0,
      supplier_count: (s as any).sourcing_session_suppliers?.[0]?.count ?? 0,
      request_number: (s as any).request_number ?? null,
      creator_name: s.user_id ? (memberNames[s.user_id] ?? null) : null,
      new_response_count: newResponseMap[s.id] ?? 0,
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
