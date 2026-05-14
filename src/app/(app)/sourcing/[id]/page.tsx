export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDetail } from './SourcingDetail'

export default async function SourcingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all data in a single parallel round — none of these depend on each other
  const [
    { data: session },
    { data: sessionSuppliers },
    { data: items },
    { data: suppliers },
    { data: projects },
  ] = await Promise.all([
    supabase.from('sourcing_sessions').select('*, project:projects(project_name)').eq('id', id).maybeSingle() as any,
    supabase
      .from('sourcing_session_suppliers')
      .select('*, assignments:sourcing_item_assignments(*, pending_supplier_specs, spec_approval_status, spec_approved_at, response:sourcing_item_responses(*))')
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('sourcing_session_items').select('*, category, item_specs, pushed_to_project_id').eq('session_id', id).order('sort_order', { ascending: true }),
    supabase.from('suppliers').select('id, supplier_name, email').order('supplier_name').limit(500),
    supabase.from('projects').select('id, project_number, project_name').is('archived_at', null).order('created_at', { ascending: false }).limit(50),
  ])

  if (!session) notFound()

  const sessionProject = Array.isArray(session.project) ? session.project[0] : session.project

  const enrichedSuppliers = (sessionSuppliers ?? []).map((ss: any) => {
    const assignments = (ss.assignments ?? []).map((a: any) => ({
      id: a.id,
      item_id: a.item_id,
      status: a.status,
      responded_at: a.responded_at,
      accepted_at: a.accepted_at,
      created_at: a.created_at,
      pending_supplier_specs: a.pending_supplier_specs ?? null,
      spec_approval_status: a.spec_approval_status ?? null,
      spec_approved_at: a.spec_approved_at ?? null,
      response: Array.isArray(a.response) ? (a.response[0] ?? null) : a.response,
    }))
    return {
      id: ss.id,
      supplier_id: ss.supplier_id,
      supplier_name: ss.supplier_name,
      email: ss.email,
      token: ss.token,
      status: ss.status,
      sent_at: ss.sent_at,
      supplier_message_count: ss.supplier_message_count ?? 0,
      assignments,
    }
  })

  const requestNumber = (session as any).request_number ?? null
  const requestRef = requestNumber ? `PR-${String(requestNumber).padStart(3, '0')}` : null

  return (
    <div>
      <PageHeader
        title={session.title}
        subtitle={[requestRef, (sessionProject as any)?.project_name].filter(Boolean).join(' · ') || 'Price Request'}
        actions={
          <Link href="/sourcing" className="inline-flex items-center gap-1 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
            <ChevronLeft size={15} /> All Price Requests
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <SourcingDetail
          session={{
            id: session.id,
            title: session.title,
            status: session.status,
            archived: session.archived,
            project_id: session.project_id,
            project_name: (sessionProject as any)?.project_name ?? null,
          }}
          initialItems={items ?? []}
          initialSuppliers={enrichedSuppliers}
          allSuppliers={(suppliers ?? []) as { id: string; supplier_name: string; email: string | null }[]}
          projects={(projects ?? []) as { id: string; project_number: string | null; project_name: string }[]}
        />
      </div>
    </div>
  )
}
