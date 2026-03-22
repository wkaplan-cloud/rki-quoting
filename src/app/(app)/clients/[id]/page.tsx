export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ClientForm } from './ClientForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  if (id === 'new') {
    return (
      <div>
        <PageHeader title="New Client" />
        <div className="p-8 max-w-2xl"><ClientForm client={null} projects={[]} /></div>
      </div>
    )
  }

  const [{ data: client }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('projects').select('id, project_name, project_number, status, date').eq('client_id', id).order('created_at', { ascending: false }),
  ])
  if (!client) notFound()

  return (
    <div>
      <PageHeader title={client.client_name} subtitle={client.company ?? undefined} />
      <div className="p-8 max-w-2xl"><ClientForm client={client} projects={projects ?? []} /></div>
    </div>
  )
}
