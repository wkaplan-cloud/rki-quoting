export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'

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
            userProfile={userProfile}
            sourcingSessions={[]}
            connectedSuppliers={[]}
            electricianAccounts={[]}
            priceLists={[]}
          />
        </div>
      </div>
    )
  }

  const [{ data: members }, { data: auditLogs }, { data: settings }, { data: allProjects }, { data: rawSessions }, { data: priceLists }] = await Promise.all([
    supabaseAdmin.from('org_members').select('id, user_id, invited_email, full_name, role, status, invited_at, joined_at').eq('org_id', orgId).order('invited_at'),
    supabaseAdmin.from('audit_logs').select('id, user_email, action, table_name, record_id, old_data, new_data, created_at').eq('org_id', orgId).gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).order('created_at', { ascending: false }).limit(200),
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('projects')
      .select('id, project_name, project_number, status, date, design_fee, vat_rate, client:clients(client_name), stages:project_stages(final_invoice_paid)')
      .is('archived_at', null)
      .order('date', { ascending: false }),
    supabase.from('sourcing_sessions')
      .select('id, title, status, created_at, request_number, project:projects(project_name), sourcing_session_items(count), sourcing_session_suppliers(count)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('price_lists')
      .select('id, name, supplier_name, item_count, is_global')
      .order('created_at', { ascending: false }),
  ])

  // Build sourcing sessions summary
  const sourcingSessions = (rawSessions ?? []).map((s: any) => {
    const project = Array.isArray(s.project) ? s.project[0] : s.project
    return {
      id: s.id as string,
      title: s.title as string | null,
      status: s.status as string,
      created_at: s.created_at as string,
      item_count: (s.sourcing_session_items?.[0]?.count ?? 0) as number,
      supplier_count: (s.sourcing_session_suppliers?.[0]?.count ?? 0) as number,
      request_number: (s.request_number ?? null) as number | null,
      project_name: ((project as any)?.project_name ?? null) as string | null,
    }
  })

  // Fetch connected supplier portal accounts via sourcing session suppliers
  const sessionIds = sourcingSessions.map(s => s.id)
  let connectedSuppliers: { id: string; company_name: string; email: string; supplier_category: string | null; plan: string | null; subscription_status: string | null }[] = []
  let electricianAccounts: typeof connectedSuppliers = []

  if (sessionIds.length > 0) {
    const { data: sessionSuppliers } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('portal_account_id')
      .in('sourcing_session_id', sessionIds)
      .not('portal_account_id', 'is', null)

    const uniqueAccountIds = [...new Set((sessionSuppliers ?? []).map(s => s.portal_account_id as string).filter(Boolean))]

    if (uniqueAccountIds.length > 0) {
      const { data: accounts } = await supabaseAdmin
        .from('supplier_portal_accounts')
        .select('id, company_name, email, supplier_category, plan, subscription_status')
        .in('id', uniqueAccountIds)

      const allAccounts = accounts ?? []
      connectedSuppliers = allAccounts.filter(a => a.supplier_category !== 'trades')
      electricianAccounts = allAccounts.filter(a => a.supplier_category === 'trades')
    }
  }

  const paidProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid === true
  })

  const pipelineProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid !== true && (p as any).status !== 'Draft'
  })

  const paidIds = new Set(paidProjects.map(p => p.id))
  const pipelineIds = new Set(pipelineProjects.map(p => p.id))
  const relevantProjectIds = [...new Set([...paidIds, ...pipelineIds])]

  const { data: allLineItems } = relevantProjectIds.length > 0
    ? await supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity, row_type').in('project_id', relevantProjectIds)
    : { data: [] }

  const completedLineItems = (allLineItems ?? []).filter(li => paidIds.has(li.project_id))
  const pipelineLineItems = (allLineItems ?? []).filter(li => pipelineIds.has(li.project_id))

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage your team, portals and studio activity" />
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
          userProfile={userProfile}
          sourcingSessions={sourcingSessions}
          connectedSuppliers={connectedSuppliers}
          electricianAccounts={electricianAccounts}
          priceLists={(priceLists ?? []).map(p => ({
            id: p.id,
            name: p.name,
            supplier_name: (p as any).supplier_name ?? null,
            item_count: (p as any).item_count ?? null,
            is_global: !!(p as any).is_global,
          }))}
        />
      </div>
    </div>
  )
}
