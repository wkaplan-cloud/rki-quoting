export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClientBoards } from './ClientBoards'

export default async function StudioClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const [{ data: settings }, { data: member }] = await Promise.all([
    supabaseAdmin
      .from('settings')
      .select('studio_enabled, logo_url, studio_logo_url')
      .eq('org_id', orgId)
      .maybeSingle(),
    // Stamped onto any board created here. org_members is the roster of real
    // people in the org — auth metadata is not reliably set.
    supabaseAdmin
      .from('org_members')
      .select('full_name')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!settings?.studio_enabled) redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id, client_name, company')
    .eq('id', clientId)
    .maybeSingle()
  if (!client) notFound()

  const [{ data: boards }, { data: allClients }] = await Promise.all([
    supabase
      .from('studio_boards')
      .select('id, name, updated_at, created_at, project_id, created_by_name')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false }),
    // Targets for "Move to client" on a board filed under the wrong one
    supabase.from('clients').select('id, client_name, company').order('client_name'),
  ])

  return (
    <div>
      <PageHeader
        title={client.client_name}
        subtitle={client.company || 'Presentation boards'}
        actions={
          <Link
            href="/studio"
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#D8D3C8] bg-white text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors"
          >
            <ArrowLeft size={13} /> All clients
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <ClientBoards
          orgId={orgId}
          clientId={clientId}
          clientName={client.client_name}
          userId={user.id}
          userName={member?.full_name || user.email || null}
          logoUrl={settings.studio_logo_url ?? settings.logo_url ?? null}
          clients={(allClients ?? []).map(c => ({
            id: c.id as string,
            clientName: c.client_name as string,
            company: (c.company as string | null) ?? '',
          }))}
          initialBoards={(boards ?? []).map(b => ({
            id: b.id as string,
            name: b.name as string,
            updatedAt: b.updated_at as string,
            projectId: (b.project_id as string | null) ?? null,
            createdByName: (b.created_by_name as string | null) ?? null,
          }))}
        />
      </div>
    </div>
  )
}
