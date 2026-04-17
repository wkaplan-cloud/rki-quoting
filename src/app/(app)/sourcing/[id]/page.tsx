export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SourcingDetail } from './SourcingDetail'
import type { SourcingRequestWithRelations, Project, Supplier } from '@/lib/types'

export default async function SourcingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase.from('settings').select('sourcing_enabled').maybeSingle()
  if (!settings?.sourcing_enabled) redirect('/dashboard')

  // Fetch request + images + recipients + responses in parallel
  const [
    { data: request },
    { data: images },
    { data: recipients },
    { data: suppliers },
    { data: projects },
  ] = await Promise.all([
    supabase.from('sourcing_requests').select('*').eq('id', id).maybeSingle(),
    supabase.from('sourcing_request_images').select('*').eq('sourcing_request_id', id).order('sort_order'),
    supabase.from('sourcing_request_recipients').select('*').eq('sourcing_request_id', id).order('created_at'),
    supabase.from('suppliers').select('id, supplier_name, markup_percentage, email').order('supplier_name'),
    supabase.from('projects').select('id, project_number, project_name').order('created_at', { ascending: false }),
  ])

  if (!request) notFound()

  // Fetch responses for all recipients
  const recipientIds = (recipients ?? []).map(r => r.id)
  const { data: responses } = recipientIds.length > 0
    ? await supabase
        .from('sourcing_request_responses')
        .select('*')
        .in('recipient_id', recipientIds)
    : { data: [] }

  // Build recipient + response + supplier join
  const supplierMap = new Map((suppliers ?? []).map(s => [s.id, s]))
  const enrichedRecipients = (recipients ?? []).map(r => ({
    ...r,
    response: (responses ?? []).find(res => res.recipient_id === r.id) ?? null,
    supplier: r.supplier_id ? (supplierMap.get(r.supplier_id) ?? null) : null,
  }))

  const fullRequest: SourcingRequestWithRelations = {
    ...request,
    images: images ?? [],
    recipients: enrichedRecipients,
  }

  return (
    <div>
      <PageHeader
        title={request.title}
        subtitle="Pricing Request"
        actions={
          <Link href="/sourcing" className="inline-flex items-center gap-1 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
            <ChevronLeft size={15} /> All Requests
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <SourcingDetail
          request={fullRequest}
          allSuppliers={(suppliers ?? []) as Supplier[]}
          projects={(projects ?? []) as Pick<Project, 'id' | 'project_number' | 'project_name'>[]}
        />
      </div>
    </div>
  )
}
