export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { StudioHome } from './StudioHome'

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('studio_enabled')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.studio_enabled) redirect('/dashboard')

  const [{ data: projects }, { data: boards }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_number, project_name, status, created_at, clients(client_name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('studio_boards').select('project_id, updated_at'),
  ])

  const boardByProject = new Map((boards ?? []).map(b => [b.project_id, b.updated_at]))
  const rows = (projects ?? []).map(p => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients
    return {
      id: p.id as string,
      projectNumber: p.project_number as string,
      projectName: p.project_name as string,
      status: p.status as string,
      clientName: (client?.client_name as string) ?? '',
      boardUpdatedAt: (boardByProject.get(p.id) as string) ?? null,
    }
  })

  return (
    <div>
      <PageHeader
        title="Studio"
        subtitle="Client presentation boards — pick a project to start designing"
      />
      <div className="p-6 lg:p-8">
        <StudioHome projects={rows} />
      </div>
    </div>
  )
}
