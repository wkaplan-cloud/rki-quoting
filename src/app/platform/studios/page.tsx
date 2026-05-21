export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, ChevronRight } from 'lucide-react'
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

  // Users who confirmed email within the last 30 days
  const confirmed = allUsers.filter(u =>
    u.email_confirmed_at && u.email_confirmed_at >= cutoff
  )
  if (confirmed.length === 0) return []

  const ids = confirmed.map(u => u.id)

  // Filter out users who have completed onboarding or are suppliers
  const [{ data: members }, { data: suppliers }] = await Promise.all([
    supabaseAdmin.from('org_members').select('user_id').in('user_id', ids),
    supabaseAdmin.from('supplier_portal_accounts').select('auth_user_id').in('auth_user_id', ids),
  ])

  const hasOrg = new Set((members ?? []).map((m: { user_id: string }) => m.user_id))
  const isSupplier = new Set((suppliers ?? []).map((s: { auth_user_id: string }) => s.auth_user_id))

  // Get nudge records for these users
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

  const enriched = await Promise.all(
    (orgs ?? []).map(async (org) => {
      // Fetch active member count, admin (any status, prefer active), and project count by org_id in parallel
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

      return {
        ...org,
        businessName,
        memberCount: memberCount ?? 0,
        projectCount: projectCount ?? 0,
        adminName: adminMember?.full_name || adminMember?.invited_email || '—',
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Studios</h1>
        <p className="text-sm text-white/40">{activeStudios.length} active studio{activeStudios.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active subscriptions', value: activeCount, color: 'text-emerald-400' },
          { label: 'In trial', value: trialCount, color: 'text-[#C4A46B]' },
          { label: 'Trial expired', value: expiredCount, color: 'text-red-400' },
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
            <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Joined</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {studios.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center text-white/30 text-sm">No studios yet</td>
            </tr>
          )}
          {studios.map(studio => (
            <tr key={studio.id} className="hover:bg-white/5 transition-colors">
              <td className="px-5 py-3.5">
                <p className="text-white font-medium">{studio.businessName}</p>
                {studio.businessName !== studio.name && (
                  <p className="text-xs text-white/30 mt-0.5">{studio.name}</p>
                )}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
