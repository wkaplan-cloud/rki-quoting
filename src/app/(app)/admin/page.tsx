export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'
import { StorageWidget } from './StorageWidget'

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
      .select('id, project_name, project_number, status, date, design_fee, vat_rate, client:clients(client_name), stages:project_stages(final_invoice_paid)')
      .is('archived_at', null)
      .order('date', { ascending: false }),
  ])

  const paidProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid === true
  })

  const pipelineProjects = (allProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid !== true && p.status !== 'Draft'
  })

  const paidIds = new Set(paidProjects.map(p => p.id))
  const pipelineIds = new Set(pipelineProjects.map(p => p.id))
  const relevantProjectIds = [...new Set([...paidIds, ...pipelineIds])]

  // Fetch line_items only for the projects we actually need — not the entire org's history
  const { data: allLineItems } = relevantProjectIds.length > 0
    ? await supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity, row_type').in('project_id', relevantProjectIds)
    : { data: [] }

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
          userProfile={userProfile}
        />
      </div>
    </div>
  )
}
