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
    .select('studio_enabled, logo_url, studio_logo_url')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.studio_enabled) redirect('/dashboard')

  const [{ data: clients }, { data: boards }, { data: assetSizes }] = await Promise.all([
    supabase.from('clients').select('id, client_name, company').order('client_name'),
    supabase
      .from('studio_boards')
      .select('id, name, updated_at, client_id, clients(client_name, company)')
      .order('updated_at', { ascending: false }),
    // One query for every board's asset sizes, grouped client-side into a
    // map — avoids an N+1 per-board query regardless of how many boards exist
    supabase.from('studio_assets').select('board_id, file_size'),
  ])

  const clientRows = (clients ?? []).map(c => ({
    id: c.id as string,
    clientName: c.client_name as string,
    company: (c.company as string | null) ?? '',
  }))

  const sizeByBoard = new Map<string, number>()
  for (const a of assetSizes ?? []) {
    sizeByBoard.set(a.board_id, (sizeByBoard.get(a.board_id) ?? 0) + (a.file_size ?? 0))
  }

  const boardRows = (boards ?? []).map(b => {
    // Supabase FK joins come back as an array even for a to-one relation
    const client = Array.isArray(b.clients) ? b.clients[0] : b.clients
    return {
      id: b.id as string,
      name: b.name as string,
      updatedAt: b.updated_at as string,
      clientId: b.client_id as string,
      clientName: (client?.client_name as string | undefined) ?? '',
      company: (client?.company as string | null | undefined) ?? '',
      sizeBytes: sizeByBoard.get(b.id as string) ?? 0,
    }
  })

  return (
    <div>
      <PageHeader title="Studio" subtitle="Presentation boards for your clients" />
      <div className="p-6 lg:p-8">
        <StudioHome
          orgId={orgId}
          logoUrl={settings.studio_logo_url ?? settings.logo_url ?? null}
          clients={clientRows}
          boards={boardRows}
        />
      </div>
    </div>
  )
}
