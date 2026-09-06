export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, ChevronRight, AlertTriangle, FlaskConical } from 'lucide-react'
import Link from 'next/link'
import { QuickDeleteButton } from './[id]/DeleteStudioButton'
import { AssignRepCell } from './AssignRepCell'
import { IncompleteSignups, type IncompleteSignup } from './IncompleteSignups'
import { TestNudge } from './TestNudge'
import { SendWelcomeButton } from './SendWelcomeButton'

function PlanBadge({ plan, status, trialEndsAt }: { plan: string; status: string; trialEndsAt: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-[#047857] capitalize">
        {plan}
      </span>
    )
  }
  if (status === 'trialing') {
    const days = trialEndsAt
      // Server component: renders once per request, so reading the clock here is stable by construction.
      // eslint-disable-next-line react-hooks/purity
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0
    const expired = days === 0
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        expired ? 'bg-red-50 text-[#B91C1C]' : 'bg-[#7E6036]/12 text-[#7E6036]'
      }`}>
        {expired ? 'Trial expired' : `Trial · ${days}d left`}
      </span>
    )
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E5DFD5] text-[#6E6B63]">Cancelled</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E5DFD5] text-[#6E6B63]">{status}</span>
}

async function getIncompleteSignups(): Promise<IncompleteSignup[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const allUsers = authData?.users ?? []

  const confirmed = allUsers.filter(u =>
    u.email_confirmed_at && u.email_confirmed_at >= cutoff
  )
  if (confirmed.length === 0) return []

  const ids = confirmed.map(u => u.id)

  const [{ data: members }, { data: suppliers }, { data: portalMembers }, { data: elecStaff }] = await Promise.all([
    supabaseAdmin.from('org_members').select('user_id').in('user_id', ids),
    supabaseAdmin.from('supplier_portal_accounts').select('auth_user_id').in('auth_user_id', ids),
    supabaseAdmin.from('portal_org_members').select('auth_user_id').in('auth_user_id', ids),
    supabaseAdmin.from('elec_staff').select('auth_user_id').in('auth_user_id', ids),
  ])

  const hasOrg = new Set((members ?? []).map((m: { user_id: string }) => m.user_id))
  const isSupplier = new Set((suppliers ?? []).map((s: { auth_user_id: string }) => s.auth_user_id))
  const isPortalMember = new Set((portalMembers ?? []).map((m: { auth_user_id: string }) => m.auth_user_id))
  const isElecStaff = new Set((elecStaff ?? []).map((s: { auth_user_id: string }) => s.auth_user_id))

  const { data: nudges } = await supabaseAdmin
    .from('onboarding_nudges')
    .select('user_id, sent_at')
    .in('user_id', ids)

  const nudgeMap = new Map((nudges ?? []).map((n: { user_id: string; sent_at: string }) => [n.user_id, n.sent_at]))

  return confirmed
    .filter(u => !hasOrg.has(u.id) && !isSupplier.has(u.id) && !isPortalMember.has(u.id) && !isElecStaff.has(u.id))
    .map(u => ({
      user_id: u.id,
      email: u.email!,
      full_name: (u.user_metadata?.full_name as string | null) ?? null,
      confirmed_at: u.email_confirmed_at!,
      nudge_sent_at: nudgeMap.get(u.id) ?? null,
    }))
    .sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at))
}

/** Only the columns these bulk look-ups actually read. */
interface OrgScopedRow { org_id: string | null; created_at: string }
/** An organization row plus the counts and flags this page derives from it. */
interface StudioRow {
  id: string
  name: string | null
  plan: string | null
  status: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  archived_at: string | null
  assigned_rep: string | null
  created_at: string
  is_internal?: boolean | null
  businessName: string | null
  memberCount: number
  projectCount: number
  adminName: string
  adminEmail: string | null
  lastActive: string | null
  isChurnRisk: boolean
  isInternal: boolean
}

export default async function StudiosPage() {
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, created_at, plan, trial_ends_at, subscription_status, status, archived_at, assigned_rep, is_internal')
    .order('created_at', { ascending: false })

  const orgIds = (orgs ?? []).map(o => o.id)

  // Bulk queries in parallel
  const [
    { data: allActiveMembers },
    { data: allAdminMembers },
    { data: allProjectsData },
    { data: allSourcingData },
    { data: allAuditData },
    { data: allClientsData },
    { data: welcomeSentData },
    incompleteSignups,
  ] = await Promise.all([
    supabaseAdmin.from('org_members').select('org_id').eq('status', 'active').in('org_id', orgIds),
    supabaseAdmin.from('org_members').select('org_id, user_id, full_name, invited_email').eq('role', 'admin').in('org_id', orgIds).order('status', { ascending: true }),
    supabaseAdmin.from('projects').select('org_id, created_at, archived_at, status').order('created_at', { ascending: false }),
    supabaseAdmin.from('sourcing_sessions').select('org_id, created_at').in('org_id', orgIds).order('created_at', { ascending: false }),
    supabaseAdmin.from('audit_logs').select('org_id, created_at').in('org_id', orgIds).order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.from('clients').select('org_id, created_at').in('org_id', orgIds).order('created_at', { ascending: false }),
    supabaseAdmin.from('platform_welcome_emails').select('org_id').in('org_id', orgIds),
    getIncompleteSignups(),
  ])

  // Build lookup maps from bulk data
  const memberCountByOrg = new Map<string, number>()
  for (const m of allActiveMembers ?? []) {
    memberCountByOrg.set(m.org_id, (memberCountByOrg.get(m.org_id) ?? 0) + 1)
  }

  const adminByOrg = new Map<string, { user_id: string | null; full_name: string | null; invited_email: string | null }>()
  for (const m of allAdminMembers ?? []) {
    if (!adminByOrg.has(m.org_id)) adminByOrg.set(m.org_id, m)
  }

  const projectCountByOrg = new Map<string, number>()
  const lastActiveByOrg = new Map<string, string>()

  const bumpLastActive = (orgId: string | null, ts: string) => {
    if (!orgId) return
    const cur = lastActiveByOrg.get(orgId)
    if (!cur || ts > cur) lastActiveByOrg.set(orgId, ts)
  }

  for (const p of allProjectsData ?? []) {
    bumpLastActive(p.org_id, p.created_at)
    if (p.org_id && !p.archived_at && p.status !== 'Cancelled') {
      projectCountByOrg.set(p.org_id, (projectCountByOrg.get(p.org_id) ?? 0) + 1)
    }
  }
  for (const s of allSourcingData ?? []) bumpLastActive(s.org_id, s.created_at)
  for (const a of (allAuditData ?? []) as OrgScopedRow[]) bumpLastActive(a.org_id, a.created_at)
  for (const c of (allClientsData ?? []) as OrgScopedRow[]) bumpLastActive(c.org_id, c.created_at)

  // One bulk settings fetch keyed by org_id (settings are org-scoped, not user-scoped)
  const { data: allSettings } = orgIds.length > 0
    ? await supabaseAdmin.from('settings').select('org_id, business_name').in('org_id', orgIds)
    : { data: [] as { org_id: string; business_name: string | null }[] }
  const businessNameByOrgId = new Map((allSettings ?? []).map(s => [s.org_id, s.business_name]))

  const welcomeSentOrgIds = new Set((welcomeSentData ?? []).map(r => r.org_id))

  // Server component: renders once per request, so reading the clock here is stable by construction.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

  const enriched: StudioRow[] = (orgs ?? []).map(org => {
    const admin = adminByOrg.get(org.id)
    const businessName = businessNameByOrgId.get(org.id) || org.name
    const lastActive = lastActiveByOrg.get(org.id) ?? null
    const isPaid = org.subscription_status === 'active'
    const isInternal = (org as { is_internal?: boolean | null }).is_internal ?? false
    const isChurnRisk = isPaid && !isInternal && (!lastActive || new Date(lastActive) < thirtyDaysAgo)

    return {
      ...org,
      businessName,
      memberCount: memberCountByOrg.get(org.id) ?? 0,
      projectCount: projectCountByOrg.get(org.id) ?? 0,
      adminName: admin?.full_name || admin?.invited_email || '—',
      adminEmail: admin?.invited_email ?? null,
      lastActive,
      isChurnRisk,
      isInternal,
    }
  })

  const activeStudios = enriched.filter(o => o.status !== 'archived')
  const archivedStudios = enriched.filter(o => o.status === 'archived')

  const trialCount = activeStudios.filter(o => o.subscription_status === 'trialing').length
  const activeCount = activeStudios.filter(o => o.subscription_status === 'active').length
  const expiredCount = activeStudios.filter(o => {
    if (o.subscription_status !== 'trialing') return false
    // Server component: renders once per request, so reading the clock here is stable by construction.
    // eslint-disable-next-line react-hooks/purity
    const days = o.trial_ends_at ? Math.max(0, Math.ceil((new Date(o.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0
    return days === 0
  }).length
  const churnRiskCount = activeStudios.filter(o => o.isChurnRisk).length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-[#1A1A18] mb-1">Studios</h1>
        <p className="text-sm text-[#6E6B63]">{activeStudios.length} active studio{activeStudios.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Active subscriptions', value: activeCount, color: 'text-[#047857]' },
          { label: 'In trial', value: trialCount, color: 'text-[#7E6036]' },
          { label: 'Trial expired', value: expiredCount, color: 'text-[#B91C1C]' },
          { label: 'Churn risk', value: churnRiskCount, color: churnRiskCount > 0 ? 'text-[#B91C1C]' : 'text-[#6E6B63]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl px-5 py-4">
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-[#6E6B63] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <StudioTable studios={activeStudios} welcomeSentOrgIds={welcomeSentOrgIds} />

      {archivedStudios.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-medium text-[#6E6B63] uppercase tracking-wider">Archived Studios</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-[#8F5706]">{archivedStudios.length}</span>
          </div>
          <StudioTable studios={archivedStudios} archived welcomeSentOrgIds={welcomeSentOrgIds} />
        </div>
      )}

      <IncompleteSignups signups={incompleteSignups} />
      <TestNudge />
    </div>
  )
}

function formatLastActive(dateStr: string | null): { label: string; urgent: boolean } {
  if (!dateStr) return { label: 'Never', urgent: true }
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return { label: 'Today', urgent: false }
  if (days === 1) return { label: 'Yesterday', urgent: false }
  if (days < 7) return { label: `${days}d ago`, urgent: false }
  if (days < 30) return { label: `${days}d ago`, urgent: false }
  return { label: `${days}d ago`, urgent: true }
}

function StudioTable({ studios, archived = false, welcomeSentOrgIds }: { studios: StudioRow[]; archived?: boolean; welcomeSentOrgIds: Set<string> }) {
  return (
    <div className={`bg-[#FDFCF9] border rounded-xl overflow-hidden ${archived ? 'border-amber-200 opacity-70' : 'border-[#DED8CC]'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[58rem]">
          <thead>
            <tr className="border-b border-[#DED8CC]">
              <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Studio / Business</th>
              <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Admin</th>
              <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Rep</th>
              <th className="text-center px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><Users size={11} /> Members</div>
              </th>
              <th className="text-center px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><FolderOpen size={11} /> Projects</div>
              </th>
              <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">{archived ? 'Archived' : 'Plan'}</th>
              {!archived && <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Last Active</th>}
              <th className="text-left px-5 py-3 text-xs text-[#6E6B63] uppercase tracking-wider font-medium">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEBE3]">
            {studios.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-[#6E6B63] text-sm">No studios yet</td>
              </tr>
            )}
            {studios.map(studio => {
              const { label: lastActiveLabel, urgent: lastActiveUrgent } = formatLastActive(studio.lastActive)
              return (
                <tr key={studio.id} className={`hover:bg-[#EFEBE3] transition-colors ${studio.isChurnRisk ? 'border-l-2 border-rose-500/40' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-[#1A1A18] font-medium">{studio.businessName}</p>
                        {studio.businessName !== studio.name && (
                          <p className="text-xs text-[#6E6B63] mt-0.5">{studio.name}</p>
                        )}
                      </div>
                      {studio.isChurnRisk && (
                        <span title="Churn risk"><AlertTriangle size={12} className="text-[#B91C1C] shrink-0" /></span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {studio.adminEmail ? (
                      studio.adminName === studio.adminEmail ? (
                        <a href={`mailto:${studio.adminEmail}`} className="text-[#7E6036] hover:underline text-sm">{studio.adminEmail}</a>
                      ) : (
                        <div>
                          <p className="text-[#3F3D38]">{studio.adminName}</p>
                          <a href={`mailto:${studio.adminEmail}`} className="text-xs text-[#7E6036] hover:underline">{studio.adminEmail}</a>
                        </div>
                      )
                    ) : (
                      <span className="text-[#3F3D38]">{studio.adminName}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <AssignRepCell orgId={studio.id} initial={studio.assigned_rep ?? null} />
                  </td>
                  <td className="px-5 py-3.5 text-center text-[#3F3D38]">{studio.memberCount}</td>
                  <td className="px-5 py-3.5 text-center text-[#3F3D38]">{studio.projectCount}</td>
                  <td className="px-5 py-3.5">
                    {archived
                      ? <span className="text-xs text-[#8F5706]/70">{studio.archived_at ? new Date(studio.archived_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                      : studio.isInternal
                        ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-[#6D28D9]">
                            <FlaskConical size={10} /> Internal
                          </span>
                        )
                        : <PlanBadge plan={studio.plan ?? 'trial'} status={studio.subscription_status ?? 'trialing'} trialEndsAt={studio.trial_ends_at} />
                    }
                  </td>
                  {!archived && (
                    <td className="px-5 py-3.5">
                      <span className={`text-xs ${lastActiveUrgent ? 'text-[#B91C1C]' : 'text-[#6E6B63]'}`}>{lastActiveLabel}</span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-[#6E6B63] text-xs">
                    {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Link href={`/platform/studios/${studio.id}`} className="flex items-center gap-1 text-xs text-[#7E6036] hover:underline">
                        {archived ? 'View' : 'Manage'} <ChevronRight size={12} />
                      </Link>
                      {!archived && !welcomeSentOrgIds.has(studio.id) && (
                        <SendWelcomeButton orgId={studio.id} />
                      )}
                      {!archived && <QuickDeleteButton orgId={studio.id} studioName={studio.businessName ?? 'Unnamed studio'} />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
