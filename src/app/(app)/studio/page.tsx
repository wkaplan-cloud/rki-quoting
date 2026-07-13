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

  const [{ data: clients }, { data: boards }] = await Promise.all([
    supabase.from('clients').select('id, client_name, company').order('client_name'),
    supabase.from('studio_boards').select('client_id, updated_at'),
  ])

  const boardStats = new Map<string, { count: number; lastEdited: string }>()
  for (const b of boards ?? []) {
    const prev = boardStats.get(b.client_id)
    boardStats.set(b.client_id, {
      count: (prev?.count ?? 0) + 1,
      lastEdited: prev && prev.lastEdited > b.updated_at ? prev.lastEdited : b.updated_at,
    })
  }

  const rows = (clients ?? []).map(c => ({
    id: c.id as string,
    clientName: c.client_name as string,
    company: (c.company as string | null) ?? '',
    boardCount: boardStats.get(c.id)?.count ?? 0,
    lastEdited: boardStats.get(c.id)?.lastEdited ?? null,
  }))

  return (
    <div>
      <PageHeader
        title="Studio"
        subtitle="Client presentation boards — pick a client to start designing"
      />
      <div className="p-6 lg:p-8">
        <StudioHome clients={rows} />
      </div>
    </div>
  )
}
