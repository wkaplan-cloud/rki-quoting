export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { QuickDeleteButton } from './[id]/DeleteStudioButton'
import { AssignRepCell } from './AssignRepCell'
import { IncompleteSignups, type IncompleteSignup } from './IncompleteSignups'

function PlanBadge({ plan, status, trialEndsAt }: { plan: string; status: string; trialEndsAt: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 capitalize">
        {plan}
      </span>
    )
  }
  if (status === 'trialing') {
    const days = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0
    const expired = days === 0
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        expired ? 'bg-red-500/15 text-red-400' : 'bg-[#9A7B4F]/20 text-[#C4A46B]'
      }`}>
        {expired ? 'Trial expired' : `Trial · ${days}d left`}
      </span>
    )
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40">Cancelled</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40">{status}</span>
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

  const [{ data: members }, { data: suppliers }] = await Promise.all([
    supabaseAdmin.from('org_members').select('user_id').in('user_id', ids),
    supabaseAdmin.from('supplier_portal_accounts').select('auth_user_id').in('auth_user_id', ids),
  ])

  const hasOrg = new Set((members ?? []).map((m: { user_id: string }) => m.user_id))
  const isSupplier = new Set((suppliers ?? []).map((s: { auth_user_id: string }) => s.auth_user_id))

  const { data: nudges } = await supabaseAdmin
    .from('onboarding_nudges')
    .select('user_id, sent_at')
    .in('user_id', ids)

  const nudgeMap = new Map((nudges ?? []).map((n: { user_id: string; sent_at: string }) => [n.user_id, n.sent_at]))

  return confirmed
    .filter(u => !hasOrg.has(u.id) && !isSupplier.has(u.id))
    .map(u => ({
      user_id: u.id,
      email: u.email!,
      full_name: (u.user_metadata?.full_name as string | null) ?? null,
      confirmed_at: u.email_confirmed_at!,
      nudge_sent_at: nudgeMap.get(u.id) ?? null,
    }))
    .sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at))
}

export default async function StudiosPage() {
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, created_at, plan, trial_ends_at, subscription_status, status, archived_at, assigned_rep')
    .order('created_at', { ascending: false })

  // Get last project date per org efficiently
  const { data: recentProjects } = await supabaseAdmin
    .from('projects')
    .select('org_id, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  const lastActiveByOrg = new Map<string, string>()
  for (const p of recentProjects ?? []) {
    if (p.org_id && !lastActiveByOrg.has(p.org_id)) {
      lastActiveByOrg.set(p.org_id, p.created_at)
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)

  const enriched = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const [{ count: memberCount }, { data: adminMember }, { count: projectCount }] = await Promise.all([
        supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'active'),
        supabaseAdmin.from('org_members').select('user_id, full_name, invited_email, status').eq('org_id', org.id).eq('role', 'admin').order('status', { ascending: true }).limit(1).maybeSingle(),
        supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('org_id', org.id).is('archived_at', null).neq('status', 'Cancelled'),
      ])

      let businessName = org.name
      if (adminMember?.user_id) {
        const { data: settings } = await supabaseAdmin.from('settings').select('business_name').eq('user_id', adminMember.user_id).maybeSingle()
        if (settings?.business_name) businessName = settings.business_name
      }

      const lastActive = lastActiveByOrg.get(org.id) ?? null
      const isPaid = org.subscription_status === 'active'
      const isChurnRisk = isPaid && (!lastActive || new Date(lastActive) < thirtyDaysAgo)

      return {
        ...org,
        businessName,
        memberCount: memberCount ?? 0,
        projectCount: projectCount ?? 0,
        adminName: adminMember?.full_name || adminMember?.invited_email || '—',
        lastActive,
        isChurnRisk,
      }
    })
  )

  const [activeStudios, archivedStudios, incompleteSignups] = [
    enriched.filter(o => o.status !== 'archived'),
    enriched.filter(o => o.status === 'archived'),
    await getIncompleteSignups(),
  ]

  const trialCount = activeStudios.filter(o => o.subscription_status === 'trialing').length
  const activeCount = activeStudios.filter(o => o.subscription_status === 'active').length
  const expiredCount = activeStudios.filter(o => {
    if (o.subscription_status !== 'trialing') return false
    const days = o.trial_ends_at ? Math.max(0, Math.ceil((new Date(o.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0
    return days === 0
  }).length
  const churnRiskCount = activeStudios.filter(o => o.isChurnRisk).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Studios</h1>
        <p className="text-sm text-white/40">{activeStudios.length} active studio{activeStudios.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active subscriptions', value: activeCount, color: 'text-emerald-400' },
          { label: 'In trial', value: trialCount, color: 'text-[#C4A46B]' },
          { label: 'Trial expired', value: expiredCount, color: 'text-red-400' },
          { label: 'Churn risk', value: churnRiskCount, color: churnRiskCount > 0 ? 'text-rose-400' : 'text-white/40' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl px-5 py-4">
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <StudioTable studios={activeStudios} />

      {archivedStudios.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">Archived Studios</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{archivedStudios.length}</span>
          </div>
          <StudioTable studios={archivedStudios} archived />
        </div>
      )}

      <IncompleteSignups signups={incompleteSignups} />
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

function StudioTable({ studios, archived = false }: { studios: any[]; archived?: boolean }) {
  return (
    <div className={`bg-[#1A1A18] border rounded-xl overflow-hidden ${archived ? 'border-amber-500/20 opacity-70' : 'border-white/10'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Studio / Business</th>
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Admin</th>
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Rep</th>
            <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
              <div className="flex items-center justify-center gap-1"><Users size={11} /> Members</div>
            </th>
            <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
              <div className="flex items-center justify-center gap-1"><FolderOpen size={11} /> Projects</div>
            </th>
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">{archived ? 'Archived' : 'Plan'}</th>
            {!archived && <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Last Active</th>}
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Joined</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {studios.length === 0 && (
            <tr>
              <td colSpan={9} className="px-5 py-10 text-center text-white/30 text-sm">No studios yet</td>
            </tr>
          )}
          {studios.map(studio => {
            const { label: lastActiveLabel, urgent: lastActiveUrgent } = formatLastActive(studio.lastActive)
            return (
              <tr key={studio.id} className={`hover:bg-white/5 transition-colors ${studio.isChurnRisk ? 'border-l-2 border-rose-500/40' : ''}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-white font-medium">{studio.businessName}</p>
                      {studio.businessName !== studio.name && (
                        <p className="text-xs text-white/30 mt-0.5">{studio.name}</p>
                      )}
                    </div>
                    {studio.isChurnRisk && (
                      <AlertTriangle size={12} className="text-rose-400 shrink-0" title="Churn risk" />
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-white/60">{studio.adminName}</td>
                <td className="px-5 py-3.5">
                  <AssignRepCell orgId={studio.id} initial={studio.assigned_rep ?? null} />
                </td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.memberCount}</td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.projectCount}</td>
                <td className="px-5 py-3.5">
                  {archived
                    ? <span className="text-xs text-amber-400/70">{studio.archived_at ? new Date(studio.archived_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    : <PlanBadge plan={studio.plan ?? 'trial'} status={studio.subscription_status ?? 'trialing'} trialEndsAt={studio.trial_ends_at} />
                  }
                </td>
                {!archived && (
                  <td className="px-5 py-3.5">
                    <span className={`text-xs ${lastActiveUrgent ? 'text-rose-400' : 'text-white/40'}`}>{lastActiveLabel}</span>
                  </td>
                )}
                <td className="px-5 py-3.5 text-white/40 text-xs">
                  {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Link href={`/platform/studios/${studio.id}`} className="flex items-center gap-1 text-xs text-[#C4A46B] hover:underline">
                      {archived ? 'View' : 'Manage'} <ChevronRight size={12} />
                    </Link>
                    {!archived && <QuickDeleteButton orgId={studio.id} studioName={studio.businessName} />}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
