export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, MessageSquare, TrendingUp, AlertTriangle, DollarSign, Activity, Percent, ArrowUpRight, Zap } from 'lucide-react'

const PLAN_PRICE: Record<string, number> = { solo: 699, studio: 1499, agency: 2499 }

export default async function PlatformDashboard() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString()

  const [
    { count: studioCount },
    { count: userCount },
    { count: projectCount },
    { count: unreadCount },
    { data: recentStudios },
    { data: orgs },
    { count: newProjectsCount },
    { data: allProjects },
    { data: sourcingOrgs },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false),
    supabaseAdmin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('organizations').select('id, plan, subscription_status, trial_ends_at, status, is_internal').eq('status', 'active'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    // For churn risk + feature adoption: get all project org_ids (ordered so first hit per org = most recent)
    supabaseAdmin.from('projects').select('org_id, created_at').order('created_at', { ascending: false }),
    // For feature adoption: which orgs have ever created a sourcing session
    supabaseAdmin.from('sourcing_sessions').select('org_id'),
  ])

  // Sourcing fee stats
  const { data: acceptedAssignments } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select('response:sourcing_item_responses(unit_price), item:sourcing_session_items(session:sourcing_sessions(project:projects(status)))')
    .eq('status', 'accepted')

  let totalFeeCollectible = 0
  for (const a of acceptedAssignments ?? []) {
    const response = Array.isArray((a as any).response) ? (a as any).response[0] : (a as any).response
    const item = Array.isArray((a as any).item) ? (a as any).item[0] : (a as any).item
    const session = Array.isArray(item?.session) ? item?.session[0] : item?.session
    const project = Array.isArray(session?.project) ? session?.project[0] : session?.project
    if (['Paid', 'Completed'].includes(project?.status)) {
      totalFeeCollectible += (response?.unit_price ?? 0) * 0.01
    }
  }

  const activeOrgs = (orgs ?? []).filter(o => o.status === 'active')
  // Exclude internal/test accounts from all business metrics
  const billableOrgs = activeOrgs.filter(o => !(o as any).is_internal)
  const paidOrgs = billableOrgs.filter(o => o.subscription_status === 'active')
  const paidCount = paidOrgs.length
  const trialCount = billableOrgs.filter(o => o.subscription_status === 'trialing').length

  const expiringTrials = billableOrgs.filter(o => {
    if (o.subscription_status !== 'trialing' || !o.trial_ends_at) return false
    const end = new Date(o.trial_ends_at)
    return end > now && end <= new Date(sevenDaysFromNow)
  })
  const expiredTrials = billableOrgs.filter(o => {
    if (o.subscription_status !== 'trialing' || !o.trial_ends_at) return false
    return new Date(o.trial_ends_at) < now
  })

  // MRR
  const mrr = paidOrgs.reduce((sum, o) => sum + (PLAN_PRICE[o.plan ?? ''] ?? 0), 0)

  // Trial conversion rate
  const totalTrialOutcomes = paidCount + expiredTrials.length
  const conversionRate = totalTrialOutcomes > 0 ? Math.round((paidCount / totalTrialOutcomes) * 100) : 0

  // Churn risk: paid studios with no project in last 30 days
  const lastProjectByOrg = new Map<string, string>()
  for (const p of allProjects ?? []) {
    if (p.org_id && !lastProjectByOrg.has(p.org_id)) {
      lastProjectByOrg.set(p.org_id, p.created_at)
    }
  }
  const churnRiskOrgs = paidOrgs.filter(o => {  // paidOrgs already excludes internal
    const last = lastProjectByOrg.get(o.id)
    if (!last) return true
    return new Date(last) < new Date(thirtyDaysAgo)
  })

  // Feature adoption — only count orgs that are in billableOrgs
  const billableOrgIds = new Set(billableOrgs.map(o => o.id))
  const orgsWithSourcing = new Set(
    (sourcingOrgs ?? []).map((s: any) => s.org_id).filter((id: string) => billableOrgIds.has(id))
  )
  const orgsWithProjects = new Set(
    (allProjects ?? []).map((p: any) => p.org_id).filter((id: string) => billableOrgIds.has(id))
  )
  const totalActiveCount = billableOrgs.length || 1
  const sourcingAdoptionPct = Math.round((orgsWithSourcing.size / totalActiveCount) * 100)
  const projectAdoptionPct = Math.round((orgsWithProjects.size / totalActiveCount) * 100)

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtShort = (n: number) => `R ${n.toLocaleString('en-ZA')}`

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Platform Overview</h1>
        <p className="text-sm text-white/40">QuotingHub CEO dashboard</p>
      </div>

      {/* Alerts */}
      {(expiringTrials.length > 0 || expiredTrials.length > 0 || churnRiskOrgs.length > 0) && (
        <div className="mb-6 space-y-2">
          {churnRiskOrgs.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <p className="text-sm text-rose-300">
                <span className="font-semibold">{churnRiskOrgs.length} paid studio{churnRiskOrgs.length > 1 ? 's' : ''}</span> at churn risk — no project activity in 30+ days
              </p>
              <a href="/platform/studios" className="ml-auto text-xs text-rose-400 hover:underline">View →</a>
            </div>
          )}
          {expiringTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                <span className="font-semibold">{expiringTrials.length} trial{expiringTrials.length > 1 ? 's' : ''}</span> expiring within 7 days — consider reaching out
              </p>
            </div>
          )}
          {expiredTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{expiredTrials.length} trial{expiredTrials.length > 1 ? 's' : ''}</span> expired and not converted
              </p>
            </div>
          )}
        </div>
      )}

      {/* MRR hero */}
      <div className="bg-[#1A1A18] border border-[#9A7B4F]/30 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Monthly Recurring Revenue</p>
            <p className="text-4xl font-semibold text-white">{fmtShort(mrr)}</p>
            <p className="text-xs text-white/30 mt-1.5">
              {paidCount} paid studio{paidCount !== 1 ? 's' : ''} ·
              {' '}Solo × {paidOrgs.filter(o => o.plan === 'solo').length} · Studio × {paidOrgs.filter(o => o.plan === 'studio').length} · Agency × {paidOrgs.filter(o => o.plan === 'agency').length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">ARR</p>
            <p className="text-2xl font-semibold text-[#C4A46B]">{fmtShort(mrr * 12)}</p>
          </div>
        </div>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Studios online', value: studioCount ?? 0, icon: Building2, color: 'text-[#C4A46B]' },
          { label: 'Total users', value: userCount ?? 0, icon: Users, color: 'text-blue-400' },
          { label: 'Total projects', value: projectCount ?? 0, icon: FolderOpen, color: 'text-emerald-400' },
          { label: 'Unread messages', value: unreadCount ?? 0, icon: MessageSquare, color: 'text-rose-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-3xl font-semibold text-white">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Paid subscriptions', value: paidCount.toString(), color: 'text-emerald-400', icon: Activity },
          { label: 'In trial', value: trialCount.toString(), color: 'text-[#C4A46B]', icon: Activity },
          { label: 'New projects (30d)', value: (newProjectsCount ?? 0).toString(), color: 'text-blue-400', icon: FolderOpen },
          { label: 'Fees collectible', value: fmt(totalFeeCollectible), color: 'text-[#C4A46B]', icon: DollarSign },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Trial conversion + churn risk row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Trial conversion funnel */}
        <div className="lg:col-span-2 bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight size={14} className="text-[#C4A46B]" />
            <h2 className="text-sm font-medium text-white">Trial conversion</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/40">Converted to paid</span>
                <span className="text-xs font-semibold text-emerald-400">{paidCount}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${conversionRate}%` }} />
              </div>
            </div>
            <div className="text-2xl font-semibold text-white w-16 text-right">{conversionRate}%</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Paid', value: paidCount, color: 'text-emerald-400' },
              { label: 'Active trials', value: trialCount - expiredTrials.length, color: 'text-[#C4A46B]' },
              { label: 'Expired (not converted)', value: expiredTrials.length, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-lg px-3 py-2.5 text-center">
                <p className={`text-xl font-semibold ${color}`}>{value}</p>
                <p className="text-xs text-white/30 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Churn risk */}
        <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className={churnRiskOrgs.length > 0 ? 'text-rose-400' : 'text-white/30'} />
            <h2 className="text-sm font-medium text-white">Churn risk</h2>
          </div>
          <p className={`text-4xl font-semibold mb-1 ${churnRiskOrgs.length > 0 ? 'text-rose-400' : 'text-white'}`}>
            {churnRiskOrgs.length}
          </p>
          <p className="text-xs text-white/30 mb-4">Paid studios, no activity 30+ days</p>
          {churnRiskOrgs.length > 0 && (
            <div className="space-y-1.5">
              {churnRiskOrgs.slice(0, 3).map(o => (
                <a key={o.id} href={`/platform/studios/${o.id}`} className="flex items-center justify-between text-xs text-white/50 hover:text-white transition-colors">
                  <span className="truncate">{o.plan}</span>
                  <span className="text-white/20 capitalize">{o.plan}</span>
                </a>
              ))}
              {churnRiskOrgs.length > 3 && (
                <a href="/platform/studios" className="text-xs text-[#C4A46B] hover:underline">+{churnRiskOrgs.length - 3} more →</a>
              )}
            </div>
          )}
          {churnRiskOrgs.length === 0 && (
            <p className="text-xs text-emerald-400">All paid studios active</p>
          )}
        </div>
      </div>

      {/* Feature adoption */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-[#C4A46B]" />
          <h2 className="text-sm font-medium text-white">Feature adoption</h2>
          <span className="text-xs text-white/30 ml-1">across all {billableOrgs.length} billable studios</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Have created a project', pct: projectAdoptionPct, count: orgsWithProjects.size, color: 'bg-blue-500' },
            { label: 'Using sourcing / price requests', pct: sourcingAdoptionPct, count: orgsWithSourcing.size, color: 'bg-[#C4A46B]' },
          ].map(({ label, pct, count, color }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/50">{label}</span>
                <span className="text-xs font-semibold text-white">{count} <span className="text-white/30">({pct}%)</span></span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent studios */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-[#C4A46B]" />
            <h2 className="text-sm font-medium text-white">Recently joined studios</h2>
          </div>
          <a href="/platform/studios" className="text-xs text-[#C4A46B] hover:underline">View all →</a>
        </div>
        <div className="divide-y divide-white/5">
          {recentStudios?.length === 0 && (
            <p className="px-5 py-6 text-sm text-white/30 text-center">No studios yet</p>
          )}
          {recentStudios?.map(studio => (
            <a
              key={studio.id}
              href={`/platform/studios/${studio.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-white">{studio.name}</span>
              <span className="text-xs text-white/30">
                {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
