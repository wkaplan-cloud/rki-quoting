export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProjectDetail } from './ProjectDetail'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: lineItems }, { data: clients }, { data: suppliers }, { data: items }, { data: settings }, { data: stages }] =
    await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('id', id).single(),
      supabase.from('line_items').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('clients').select('id, client_name, company').order('client_name'),
      supabase.from('suppliers').select('id, supplier_name, markup_percentage, delivery_address').order('supplier_name'),
      supabase.from('items').select('id, item_name').order('item_name'),
      supabase.from('settings').select('business_name, business_address, vat_rate').maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', id).maybeSingle(),
    ])

  if (!project) notFound()

  return (
    <ProjectDetail
      project={project}
      initialLineItems={lineItems ?? []}
      clients={clients ?? []}
      suppliers={suppliers ?? []}
      items={items ?? []}
      officeAddress={{ name: settings?.business_name ?? 'RKI Office', address: settings?.business_address ?? '' }}
      businessName={settings?.business_name ?? 'R Kaplan Interiors'}
      vatRate={settings?.vat_rate ?? 15}
      initialStages={stages ?? null}
    />
  )
}
