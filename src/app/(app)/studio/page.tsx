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
    .select('studio_enabled, logo_url')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.studio_enabled) redirect('/dashboard')

  const [{ data: clients }, { data: boards }] = await Promise.all([
    supabase.from('clients').select('id, client_name, company').order('client_name'),
    supabase
      .from('studio_boards')
      .select('id, name, updated_at, client_id, clients(client_name, company)')
      .order('updated_at', { ascending: false }),
  ])

  const clientRows = (clients ?? []).map(c => ({
    id: c.id as string,
    clientName: c.client_name as string,
    company: (c.company as string | null) ?? '',
  }))

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
    }
  })

  return (
    <div>
      <PageHeader title="Studio" subtitle="Presentation boards for your clients" />
      <div className="p-6 lg:p-8">
        <StudioHome orgId={orgId} logoUrl={settings.logo_url ?? null} clients={clientRows} boards={boardRows} />
      </div>
    </div>
  )
}
