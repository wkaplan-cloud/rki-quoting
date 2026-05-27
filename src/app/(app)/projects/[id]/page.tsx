export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ProjectDetail } from './ProjectDetail'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgId } = await supabase.rpc('get_current_org_id')
  const { data: orgMeta } = orgId
    ? await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
    : { data: null }

  const { data: members } = orgId
    ? await supabaseAdmin.from('org_members').select('user_id, invited_email, full_name, role').eq('org_id', orgId).eq('status', 'active')
    : { data: [] }

  const currentMember = (members ?? []).find(m => m.user_id === user?.id)
  const isAdmin = currentMember?.role === 'admin'

  const memberList = (members ?? [])
    .filter(m => m.user_id)
    .map(m => ({ user_id: m.user_id as string, label: m.full_name ?? m.invited_email.split('@')[0] }))

  const memberMap = Object.fromEntries(memberList.map(m => [m.user_id, m.label]))

  const [{ data: project }, { data: lineItems }, { data: clients }, { data: rawSuppliers }, { data: items }, { data: settings }, { data: stages }, { data: emailLogs }, { data: platformContacts }, { data: quoteApproval }, { data: approvalLogs }] =
    await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('id', id).single(),
      supabase.from('line_items').select('*').eq('project_id', id).order('sort_order'),
      supabase.from('clients').select('id, client_name, company').order('client_name'),
      supabase.from('suppliers').select('id, supplier_name, markup_percentage, delivery_address, delivery_contact_name, delivery_contact_number, is_platform, price_list_id, email').order('supplier_name'),
      supabase.from('items').select('id, item_name').order('item_name'),
      supabase.from('settings').select('business_name, business_address, vat_rate, deposit_percentage, sage_company_id, xero_access_token, xero_tenant_id, email_template_quote, email_template_invoice, production_sheet_email').maybeSingle(),
      supabase.from('project_stages').select('*').eq('project_id', id).maybeSingle(),
      supabase.from('email_logs').select('id, type, sent_to, sent_at, supplier_name').eq('project_id', id).order('sent_at', { ascending: false }),
      supabase.from('platform_supplier_contacts').select('supplier_id, markup_percentage, email'),
      supabase.from('quote_approvals').select('decision, comment, submitted_at, client_name').eq('project_id', id).maybeSingle(),
      supabaseAdmin.from('quote_approval_logs').select('id, decision, comment, client_name, submitted_at').eq('project_id', id).order('submitted_at', { ascending: false }),
    ])

  if (!project) notFound()

  // Self-heal: recompute status from stages and fix if stale
  if (project.status !== 'Cancelled') {
    const { statusFromStages } = await import('@/lib/types')
    const correctStatus = statusFromStages(stages ?? null)
    if (correctStatus !== project.status) {
      await supabase.from('projects').update({ status: correctStatus }).eq('id', id)
      project.status = correctStatus
    }
  }

  // Fetch active price list access for this org
  const { data: activeAccess } = orgId
    ? await supabaseAdmin.from('price_list_access').select('price_list_id').eq('org_id', orgId).eq('status', 'active')
    : { data: [] }
  const activePriceListIds = new Set((activeAccess ?? []).map(a => a.price_list_id))

  // For platform suppliers, override markup_percentage and email with the studio's own contact if set
  const suppliers = (rawSuppliers ?? []).map(s => {
    if (!s.is_platform) return s
    const contact = (platformContacts ?? []).find(c => c.supplier_id === s.id)
    if (!contact) return s
    return {
      ...s,
      ...(contact.markup_percentage != null ? { markup_percentage: contact.markup_percentage } : {}),
      ...(contact.email ? { email: contact.email } : {}),
    }
  })

  return (
    <ProjectDetail
      project={project}
      initialLineItems={lineItems ?? []}
      clients={clients ?? []}
      suppliers={suppliers}
      items={items ?? []}
      officeAddress={{ name: settings?.business_name ?? 'RKI Office', address: settings?.business_address ?? '' }}
      businessName={settings?.business_name ?? 'R Kaplan Interiors'}
      vatRate={project.vat_rate ?? settings?.vat_rate ?? 15}
      depositPct={project.deposit_percentage ?? settings?.deposit_percentage ?? 50}
      initialStages={stages ?? null}
      initialEmailLogs={emailLogs ?? []}
      initialApprovalLogs={approvalLogs ?? []}
      quoteApproval={quoteApproval ?? null}
      emailTemplateQuote={settings?.email_template_quote ?? null}
      emailTemplateInvoice={settings?.email_template_invoice ?? null}
      productionSheetEmail={settings?.production_sheet_email ?? null}
      sageConnected={!!settings?.sage_company_id}
      xeroConnected={!!(settings?.xero_access_token && settings?.xero_tenant_id)}
      activePriceListIds={[...activePriceListIds]}
      plan={orgMeta?.plan ?? 'trial'}
      members={memberList}
      isAdmin={isAdmin}
      createdByName={memberMap[project.user_id ?? ''] ?? null}
    />
  )
}
