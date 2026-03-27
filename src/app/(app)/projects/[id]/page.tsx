export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProjectDetail } from './ProjectDetail'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: lineItems }, { data: clients }, { data: suppliers }, { data: items }, { data: settings }, { data: stages }, { data: emailLogs }] =
    await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('id', id).single(),
      supabase.from('line_items').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('clients').select('id, client_name, company').order('client_name'),
      supabase.from('suppliers').select('id, supplier_name, markup_percentage, delivery_address, is_platform, price_list_id').order('supplier_name'),
      supabase.from('items').select('id, item_name').order('item_name'),
      supabase.from('settings').select('business_name, business_address, vat_rate, sage_api_key, sage_username, sage_password, sage_company_id, email_template_quote, email_template_invoice').maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', id).maybeSingle(),
      supabase.from('email_logs').select('*').eq('project_id', id).order('sent_at', { ascending: false }),
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
      vatRate={project.vat_rate ?? settings?.vat_rate ?? 15}
      initialStages={stages ?? null}
      initialEmailLogs={emailLogs ?? []}
      emailTemplateQuote={settings?.email_template_quote ?? null}
      emailTemplateInvoice={settings?.email_template_invoice ?? null}
      sageConnected={!!(settings?.sage_api_key && settings?.sage_username && settings?.sage_password && settings?.sage_company_id)}
    />
  )
}
