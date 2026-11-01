export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'
import { StorageWidget } from './StorageWidget'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { computeInsights, type InsightsLineItem } from '@/lib/insights'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const [{ data: membership }, { data: orgMeta }] = await Promise.all([
    supabaseAdmin.from('org_members').select('role, org_id, full_name').eq('user_id', user.id).eq('org_id', orgId).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('organizations').select('plan, subscription_status').eq('id', orgId).single(),
  ])

  if (orgMeta?.plan === 'solo') redirect('/dashboard')

  const isAdmin = membership?.role === 'admin'
  const meta = (user.user_metadata ?? {}) as Record<string, string>
  const userProfile = {
    fullName: membership?.full_name ?? meta.full_name ?? '',
    email: user.email ?? '',
    phone: meta.phone ?? '',
    jobTitle: meta.job_title ?? '',
  }

  // Non-admins: profile-only view
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="My Account" subtitle="Manage your profile" />
        <div className="p-8">
          <AdminPanel
            members={[]}
            auditLogs={[]}
            isAdmin={false}
            settings={null}
            plan={orgMeta?.plan ?? 'trial'}
            subscriptionStatus={'active'}
            completedProjects={[]}
            completedLineItems={[]}
            pipelineProjects={[]}
            pipelineLineItems={[]}
            draftCounts={{ total: 0, olderThan60Days: 0 }}
            insights={null}
            userProfile={userProfile}
            />
        </div>
      </div>
    )
  }

  const [{ data: members }, { data: auditLogs }, { data: settings }, { data: allProjects }] = await Promise.all([
    supabaseAdmin.from('org_members').select('id, user_id, invited_email, full_name, role, status, invited_at, joined_at').eq('org_id', orgId).order('invited_at'),
    // Server component: renders once per request, so reading the clock here is stable by construction.
    // eslint-disable-next-line react-hooks/purity
    supabaseAdmin.from('audit_logs').select('id, user_email, action, table_name, record_id, old_data, new_data, created_at').eq('org_id', orgId).gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(200),
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('projects')
      .select('id, project_name, project_number, status, date, created_at, design_fee, vat_rate, client_id, client:clients(client_name), stages:project_stages(final_invoice_paid, final_invoice_sent, final_invoice_sent_at)')
      .is('archived_at', null)
      .order('date', { ascending: false }),
  ])

  const paidProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid === true
  })

  const pipelineProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid !== true && p.status !== 'Draft' && p.status !== 'Cancelled'
  })

  // Drafts aren't priced into the pipeline (unsent, often copies) — just counted
  const drafts = (allProjects ?? []).filter(p => p.status === 'Draft')
  // eslint-disable-next-line react-hooks/purity
  const staleCutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
  const draftCounts = { total: drafts.length, olderThan60Days: drafts.filter(p => new Date(p.created_at).getTime() < staleCutoff).length }

  const paidIds = new Set(paidProjects.map(p => p.id))
  const pipelineIds = new Set(pipelineProjects.map(p => p.id))
  const relevantProjectIds = [...new Set([...paidIds, ...pipelineIds])]

  // Fetch line_items only for the projects we actually need — not the entire org's history.
  // Paged: a busy studio passes PostgREST's 1000-row cap and would silently lose lines.
  const { rows: allLineItems } = relevantProjectIds.length > 0
    ? await fetchAllRows<InsightsLineItem>((from, to) =>
        supabase.from('line_items')
          .select('id, project_id, item_name, supplier_name, cost_price, markup_percentage, quantity, row_type, sale_price_override')
          .in('project_id', relevantProjectIds)
          .order('id')
          .range(from, to))
    : { rows: [] as InsightsLineItem[] }

  // Insights tab (per-org switch): read-only report over the same projects and lines
  let insights = null
  if (settings?.insights_enabled) {
    const { rows: clients } = await fetchAllRows<{ id: string; client_name: string | null; company: string | null }>((from, to) =>
      supabase.from('clients').select('id, client_name, company').order('id').range(from, to))
    const relevant = (allProjects ?? []).filter(p => paidIds.has(p.id) || pipelineIds.has(p.id))
    insights = computeInsights(
      relevant.map(p => {
        const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
        const client = Array.isArray(p.client) ? p.client[0] : p.client
        return {
          id: p.id, project_name: p.project_name, status: p.status, design_fee: p.design_fee, vat_rate: p.vat_rate,
          client_id: p.client_id, client_name: client?.client_name ?? null,
          paid: stages?.final_invoice_paid === true,
          final_invoice_sent: stages?.final_invoice_sent === true,
          final_invoice_sent_at: stages?.final_invoice_sent_at ?? null,
        }
      }),
      allLineItems,
      clients,
    )
  }

  const completedLineItems = (allLineItems ?? []).filter(li => paidIds.has(li.project_id))
  const pipelineLineItems = (allLineItems ?? []).filter(li => pipelineIds.has(li.project_id))

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage your team, studio settings and activity" actions={<StorageWidget />} />
      <div className="p-8">
        <AdminPanel
          members={members ?? []}
          auditLogs={auditLogs ?? []}
          isAdmin={true}
          settings={settings}
          plan={orgMeta?.plan ?? 'trial'}
          subscriptionStatus={orgMeta?.subscription_status ?? 'trialing'}
          completedProjects={paidProjects}
          completedLineItems={completedLineItems ?? []}
          pipelineProjects={pipelineProjects}
          pipelineLineItems={pipelineLineItems ?? []}
          draftCounts={draftCounts}
          insights={insights}
          userProfile={userProfile}
        />
      </div>
    </div>
  )
}
