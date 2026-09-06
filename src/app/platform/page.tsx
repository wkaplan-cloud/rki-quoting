export const dynamic = 'force-dynamic'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  Building2, Users, FolderOpen, MessageSquare, AlertTriangle, Activity,
  ArrowUpRight, Zap, ChevronRight, Palette, Package, Hammer, CheckCircle2,
  UserX, BookOpen, History, Sparkles,
} from 'lucide-react'
import { one, type Embedded } from '@/lib/supabase/embed'
import { getPlatformActivity, type ActivityEvent } from '@/lib/platform-activity'
import { ActivityFeed } from './_components/ActivityFeed'

const PLAN_PRICE: Record<string, number> = { solo: 699, studio: 1499, agency: 2499 }

/** Signups that confirmed an email but never landed in any portal. */
async function getStrandedSignupCount(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const confirmed = (authData?.users ?? []).filter(u => u.email_confirmed_at && u.email_confirmed_at >= cutoff)
  if (confirmed.length === 0) return 0

  const ids = confirmed.map(u => u.id)
  const [{ data: members }, { data: suppliers }, { data: portalMembers }, { data: elecStaff }] = await Promise.all([
    supabaseAdmin.from('org_members').select('user_id').in('user_id', ids),
    supabaseAdmin.from('supplier_portal_accounts').select('auth_user_id').in('auth_user_id', ids),
    supabaseAdmin.from('portal_org_members').select('auth_user_id').in('auth_user_id', ids),
    supabaseAdmin.from('elec_staff').select('auth_user_id').in('auth_user_id', ids),
  ])

  const placed = new Set<string>([
    ...(members ?? []).map((m: { user_id: string }) => m.user_id),
    ...(suppliers ?? []).map((s: { auth_user_id: string }) => s.auth_user_id),
    ...(portalMembers ?? []).map((m: { auth_user_id: string }) => m.auth_user_id),
    ...(elecStaff ?? []).map((s: { auth_user_id: string }) => s.auth_user_id),
  ])

  return confirmed.filter(u => !placed.has(u.id)).length
}

// Cache all DB queries for 5 minutes — admin dashboard doesn't need real-time precision
const getDashboardData = unstable_cache(
  async () => {
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
      // Portal accounts drive the manufacturing / trades / supplier health cards
      { data: portalAccounts },
      { count: priceListCount },
      { count: pendingAccessCount },
      { count: sourcingSessionCount },
      { data: elecJobCards },
      { data: mfgQuotes },
      activity,
      strandedSignups,
    ] = await Promise.all([
      supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false),
      supabaseAdmin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('organizations').select('id, name, plan, subscription_status, trial_ends_at, status, is_internal').eq('status', 'active'),
      supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('projects').select('org_id, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('sourcing_sessions').select('org_id'),
      supabaseAdmin.from('supplier_portal_accounts')
        .select('id, company_name, supplier_category, subscription_status, trial_ends_at, created_at'),
      supabaseAdmin.from('price_lists').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('price_list_access').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('sourcing_sessions').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('elec_job_cards').select('portal_account_id, created_at').gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('mfg_quotes').select('portal_account_id, created_at').gte('created_at', thirtyDaysAgo),
      getPlatformActivity(20),
      getStrandedSignupCount(),
    ])

    return {
      studioCount,
      userCount,
      projectCount,
      unreadCount,
      recentStudios: recentStudios ?? [],
      orgs: orgs ?? [],
      newProjectsCount,
      allProjects: allProjects ?? [],
      sourcingOrgs: sourcingOrgs ?? [],
      portalAccounts: (portalAccounts ?? []) as PortalAccountRow[],
      priceListCount: priceListCount ?? 0,
      pendingAccessCount: pendingAccessCount ?? 0,
      sourcingSessionCount: sourcingSessionCount ?? 0,
      elecJobCardCount: (elecJobCards ?? []).length,
      mfgQuoteCount: (mfgQuotes ?? []).length,
      activity,
      strandedSignups,
      nowIso: now.toISOString(),
      thirtyDaysAgo,
      sevenDaysFromNow,
    }
  },
  ['platform-dashboard'],
  { revalidate: 300 }
)

// Supabase types embedded rows as `object | object[]`, so these queries were
// read through `as any`. Naming the shapes keeps the joins honest.
interface AcceptedAssignmentRow {
  item_id: string | null
  response: Embedded<{ unit_price: number | null }>
}
interface SessionItemRow {
  id: string
  session: Embedded<{ project_id: string | null }>
}
/** Mirrors the organizations select above — every column it asks for. */
interface OrgRow {
  id: string
  name: string | null
  plan: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  status: string | null
  is_internal: boolean | null
}
interface OrgIdRow { org_id: string | null }

/** The recent-signups list selects a different, narrower set of columns. */
interface RecentStudioRow { id: string; name: string | null; created_at: string }

/** Supplier, manufacturer and trades accounts all live in one table. */
interface PortalAccountRow {
  id: string
  company_name: string | null
  supplier_category: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  created_at: string
}

type Severity = 'critical' | 'warning' | 'notice'

const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-[#B91C1C] shadow-[0_0_0_3px_rgba(185,28,28,0.13)]',
  warning: 'bg-[#8F5706] shadow-[0_0_0_3px_rgba(143,87,6,0.13)]',
  notice: 'bg-[#0369A1] shadow-[0_0_0_3px_rgba(3,105,161,0.13)]',
}

const SEVERITY_COUNT: Record<Severity, string> = {
  critical: 'text-[#B91C1C]',
  warning: 'text-[#8F5706]',
  notice: 'text-[#0369A1]',
}

interface QueueItem {
  key: string
  severity: Severity
  count: number
  headline: string
  detail: string
  href: string
  /** Named rows shown under the headline, for the cases where names matter. */
  names?: { id: string; label: string; meta: string; href: string }[]
}

/** A horizontal ledger figure — the money band at the top of the page. */
function Figure({ label, value, tone = 'default', sub }: {
  label: string
  value: string
  tone?: 'default' | 'gold' | 'muted'
  sub?: string
}) {
  const valueClass =
    tone === 'gold' ? 'text-[#5F4726]'
    : tone === 'muted' ? 'text-[#5C5A54]'
    : 'text-[#1A1A18]'
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6B63] mb-1.5">{label}</p>
      <p className={`text-[20px] font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#6E6B63] mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ title, icon: Icon, accent, action, children }: {
  title: string
  icon: typeof Activity
  accent: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#E2DCD1] bg-[#FDFCF9] shadow-[0_1px_2px_0_rgba(44,44,42,0.04),0_8px_24px_-16px_rgba(44,44,42,0.16)] overflow-hidden flex flex-col">
      <header className="flex items-center gap-2 px-5 h-12 border-b border-[#E2DCD1]">
        <Icon size={14} className={accent} />
        <h2 className="text-[13px] font-medium text-[#1A1A18]">{title}</h2>
        {action && (
          <Link href={action.href} className="ml-auto text-[11px] text-[#6E6B63] hover:text-[#5F4726] transition-colors duration-150">
            {action.label} →
          </Link>
        )}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  )
}

export default async function PlatformDashboard() {
  const {
    studioCount, userCount, projectCount, unreadCount,
    recentStudios, orgs, newProjectsCount, allProjects, sourcingOrgs,
    portalAccounts, priceListCount, pendingAccessCount,
    sourcingSessionCount, elecJobCardCount, mfgQuoteCount, activity, strandedSignups,
    nowIso, thirtyDaysAgo, sevenDaysFromNow,
  } = await getDashboardData()

  const now = new Date(nowIso)

  const activeOrgs = orgs.filter(o => o.status === 'active')
  const billableOrgs = (activeOrgs as OrgRow[]).filter(o => !o.is_internal)
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

  const mrr = paidOrgs.reduce((sum, o) => sum + (PLAN_PRICE[o.plan ?? ''] ?? 0), 0)

  const totalTrialOutcomes = paidCount + expiredTrials.length
  const conversionRate = totalTrialOutcomes > 0 ? Math.round((paidCount / totalTrialOutcomes) * 100) : 0

  const lastProjectByOrg = new Map<string, string>()
  for (const p of allProjects) {
    if (p.org_id && !lastProjectByOrg.has(p.org_id)) {
      lastProjectByOrg.set(p.org_id, p.created_at)
    }
  }
  const churnRiskOrgs = paidOrgs.filter(o => {
    const last = lastProjectByOrg.get(o.id)
    if (!last) return true
    return new Date(last) < new Date(thirtyDaysAgo)
  })

  const billableOrgIds = new Set(billableOrgs.map(o => o.id))
  const orgsWithSourcing = new Set(
    (sourcingOrgs as OrgIdRow[]).map(s => s.org_id).filter((id): id is string => !!id && billableOrgIds.has(id))
  )
  const orgsWithProjects = new Set(
    (allProjects as OrgIdRow[]).map(p => p.org_id).filter((id): id is string => !!id && billableOrgIds.has(id))
  )
  const totalActiveCount = billableOrgs.length || 1
  const sourcingAdoptionPct = Math.round((orgsWithSourcing.size / totalActiveCount) * 100)
  const projectAdoptionPct = Math.round((orgsWithProjects.size / totalActiveCount) * 100)

  // ── Portal accounts (manufacturing / trades / supplier network) ────────────
  const mfgAccounts = portalAccounts.filter(a => a.supplier_category === 'manufacturer')
  const tradesAccounts = portalAccounts.filter(a => a.supplier_category === 'trades')

  const paidIn = (rows: PortalAccountRow[]) => rows.filter(a => a.subscription_status === 'active').length
  const trialingIn = (rows: PortalAccountRow[]) => rows.filter(a => a.subscription_status === 'trialing').length
  const expiringIn = (rows: PortalAccountRow[]) => rows.filter(a => {
    if (a.subscription_status !== 'trialing' || !a.trial_ends_at) return false
    const end = new Date(a.trial_ends_at)
    return end > now && end <= new Date(sevenDaysFromNow)
  })

  const expiringPortalTrials = [...expiringIn(mfgAccounts), ...expiringIn(tradesAccounts)]

  const fmtShort = (n: number) => `R ${n.toLocaleString('en-ZA')}`
  const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000)

  // ── The action queue ───────────────────────────────────────────────────────
  const queue: QueueItem[] = []

  if (churnRiskOrgs.length > 0) {
    queue.push({
      key: 'churn',
      severity: 'critical',
      count: churnRiskOrgs.length,
      headline: `paid studio${churnRiskOrgs.length > 1 ? 's' : ''} at churn risk`,
      detail: 'No project activity in 30+ days',
      href: '/platform/studios',
      names: churnRiskOrgs.slice(0, 4).map(o => ({
        id: o.id,
        label: o.name ?? 'Unnamed studio',
        meta: o.plan ?? '—',
        href: `/platform/studios/${o.id}`,
      })),
    })
  }
  if (expiredTrials.length > 0) {
    queue.push({
      key: 'expired',
      severity: 'critical',
      count: expiredTrials.length,
      headline: `trial${expiredTrials.length > 1 ? 's' : ''} expired without converting`,
      detail: 'Still on the books — chase or archive',
      href: '/platform/studios',
      names: expiredTrials.slice(0, 4).map(o => ({
        id: o.id,
        label: o.name ?? 'Unnamed studio',
        meta: 'expired',
        href: `/platform/studios/${o.id}`,
      })),
    })
  }
  if (expiringTrials.length > 0) {
    queue.push({
      key: 'expiring',
      severity: 'warning',
      count: expiringTrials.length,
      headline: `studio trial${expiringTrials.length > 1 ? 's' : ''} ending within 7 days`,
      detail: 'The conversion window is open now',
      href: '/platform/studios',
      names: expiringTrials.slice(0, 4).map(o => ({
        id: o.id,
        label: o.name ?? 'Unnamed studio',
        meta: `${daysLeft(o.trial_ends_at!)}d left`,
        href: `/platform/studios/${o.id}`,
      })),
    })
  }
  if (expiringPortalTrials.length > 0) {
    queue.push({
      key: 'portal-trials',
      severity: 'warning',
      count: expiringPortalTrials.length,
      headline: `portal trial${expiringPortalTrials.length > 1 ? 's' : ''} ending within 7 days`,
      detail: 'Manufacturing and trades accounts',
      href: '/platform/electricians',
      names: expiringPortalTrials.slice(0, 4).map(a => ({
        id: a.id,
        label: a.company_name ?? 'Unnamed account',
        meta: `${daysLeft(a.trial_ends_at!)}d left`,
        href: a.supplier_category === 'manufacturer' ? `/platform/manufacturing/${a.id}` : '/platform/electricians',
      })),
    })
  }
  if ((unreadCount ?? 0) > 0) {
    queue.push({
      key: 'messages',
      severity: 'warning',
      count: unreadCount ?? 0,
      headline: `unread message${(unreadCount ?? 0) > 1 ? 's' : ''}`,
      detail: 'Contact submissions waiting on a reply',
      href: '/platform/messages',
    })
  }
  if (pendingAccessCount > 0) {
    queue.push({
      key: 'access',
      severity: 'notice',
      count: pendingAccessCount,
      headline: `price-list access request${pendingAccessCount > 1 ? 's' : ''} pending`,
      detail: 'Studios blocked until you approve',
      href: '/platform/price-lists',
    })
  }
  if (strandedSignups > 0) {
    queue.push({
      key: 'stranded',
      severity: 'notice',
      count: strandedSignups,
      headline: `signup${strandedSignups > 1 ? 's' : ''} never reached a portal`,
      detail: 'Confirmed an email in the last 30 days, then stalled',
      href: '/platform/studios',
    })
  }

  const portals = [
    {
      key: 'designer',
      label: 'Designer Studios',
      icon: Palette,
      accent: 'text-[#7E6036]',
      rail: 'bg-[#7E6036]',
      href: '/platform/studios',
      headline: `${billableOrgs.length}`,
      headlineLabel: 'billable studios',
      stats: [
        { label: 'Paid', value: paidCount.toString() },
        { label: 'In trial', value: trialCount.toString() },
        { label: 'Projects 30d', value: (newProjectsCount ?? 0).toString() },
      ],
    },
    {
      key: 'supplier',
      label: 'Supplier Network',
      icon: Package,
      accent: 'text-[#0369A1]',
      rail: 'bg-[#0369A1]',
      href: '/platform/suppliers',
      headline: `${portalAccounts.length}`,
      headlineLabel: 'registered accounts',
      stats: [
        { label: 'Price lists', value: priceListCount.toString() },
        { label: 'Access pending', value: pendingAccessCount.toString() },
        { label: 'Requests 30d', value: sourcingSessionCount.toString() },
      ],
    },
    {
      key: 'manufacturing',
      label: 'Manufacturing',
      icon: Hammer,
      accent: 'text-[#C2410C]',
      rail: 'bg-[#C2410C]',
      href: '/platform/manufacturing',
      headline: `${mfgAccounts.length}`,
      headlineLabel: 'manufacturer accounts',
      stats: [
        { label: 'Paid', value: paidIn(mfgAccounts).toString() },
        { label: 'In trial', value: trialingIn(mfgAccounts).toString() },
        { label: 'Quotes 30d', value: mfgQuoteCount.toString() },
      ],
    },
    {
      key: 'trades',
      label: 'Electrical & Trades',
      icon: Zap,
      accent: 'text-[#8F5706]',
      rail: 'bg-[#8F5706]',
      href: '/platform/electricians',
      headline: `${tradesAccounts.length}`,
      headlineLabel: 'contractor accounts',
      stats: [
        { label: 'Paid', value: paidIn(tradesAccounts).toString() },
        { label: 'In trial', value: trialingIn(tradesAccounts).toString() },
        { label: 'Job cards 30d', value: elecJobCardCount.toString() },
      ],
    },
  ]

  return (
    <div className="p-6 sm:p-8 max-w-[1400px] w-full">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-[28px] leading-tight text-[#1A1A18]">Control Room</h1>
          <p className="text-[13px] text-[#6E6B63] mt-1">
            Every portal, every account, one screen · press <kbd className="text-[10px] border border-[#DED8CC] rounded px-1 py-px text-[#5C5A54]">⌘K</kbd> to jump anywhere
          </p>
        </div>
        <p className="text-[11px] text-[#6E6B63] tabular-nums">
          {now.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Money ledger — one continuous band, not a row of cards */}
      <div className="mb-8 border-y border-[#E2DCD1]">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-x-8 gap-y-6 py-5">
          <Figure
            label="Monthly recurring"
            value={fmtShort(mrr)}
            tone="gold"
            sub={`Solo ${paidOrgs.filter(o => o.plan === 'solo').length} · Studio ${paidOrgs.filter(o => o.plan === 'studio').length} · Agency ${paidOrgs.filter(o => o.plan === 'agency').length}`}
          />
          <Figure label="Annual run rate" value={fmtShort(mrr * 12)} sub={`${paidCount} paying studio${paidCount !== 1 ? 's' : ''}`} />
          <Figure label="Trial conversion" value={`${conversionRate}%`} sub={`${paidCount} won · ${expiredTrials.length} lost`} />
          <Figure label="Price requests" value={sourcingSessionCount.toLocaleString()} sub="sent in the last 30 days" />
          <Figure label="Users" value={(userCount ?? 0).toLocaleString()} tone="muted" sub={`across ${(studioCount ?? 0).toLocaleString()} studios`} />
          <Figure label="Projects" value={(projectCount ?? 0).toLocaleString()} tone="muted" sub={`${(newProjectsCount ?? 0).toLocaleString()} in last 30 days`} />
        </div>
      </div>

      {/* Needs you now */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <div className="xl:col-span-2">
          <Panel
            title="Needs you now"
            icon={AlertTriangle}
            accent={queue.length > 0 ? 'text-[#8F5706]' : 'text-[#047857]'}
          >
            {queue.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8">
                <CheckCircle2 size={18} className="text-[#047857] shrink-0" />
                <div>
                  <p className="text-[13px] text-[#1A1A18]">Nothing waiting on you.</p>
                  <p className="text-[12px] text-[#6E6B63] mt-0.5">
                    No expiring trials, no churn risk, no pending approvals, inbox clear.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-[#EFEBE3]">
                {queue.map(item => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="group flex items-start gap-3.5 px-5 py-3.5 hover:bg-[#F1EDE5] transition-colors duration-150"
                    >
                      <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[item.severity]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-[#2C2C2A]">
                          <span className={`font-semibold tabular-nums ${SEVERITY_COUNT[item.severity]}`}>
                            {item.count}
                          </span>{' '}
                          {item.headline}
                        </span>
                        <span className="block text-[11px] text-[#6E6B63] mt-0.5">{item.detail}</span>
                        {item.names && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {item.names.map(n => (
                              <span
                                key={n.id}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[#EFEBE3] px-2 py-1 text-[11px] text-[#3F3D38]"
                              >
                                <span className="truncate max-w-[13rem]">{n.label}</span>
                                <span className="text-[#6E6B63] tabular-nums">{n.meta}</span>
                              </span>
                            ))}
                            {item.count > item.names.length && (
                              <span className="inline-flex items-center rounded-md px-2 py-1 text-[11px] text-[#6E6B63]">
                                +{item.count - item.names.length} more
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={14} className="mt-1 text-[#8A877F] group-hover:text-[#5C5A54] transition-colors duration-150 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Trial conversion */}
        <Panel title="Trial conversion" icon={ArrowUpRight} accent="text-[#7E6036]" action={{ label: 'Studios', href: '/platform/studios' }}>
          <div className="p-5">
            <div className="flex items-end gap-3 mb-4">
              <p className="text-[40px] leading-none font-semibold text-[#1A1A18] tabular-nums">{conversionRate}<span className="text-[20px] text-[#6E6B63]">%</span></p>
              <p className="text-[11px] text-[#6E6B63] pb-1.5">of finished trials<br />became paying studios</p>
            </div>
            <div className="h-1.5 bg-[#E9E4DA] rounded-full overflow-hidden mb-4">
              <div className="h-full bg-[#047857] rounded-full" style={{ width: `${conversionRate}%` }} />
            </div>
            <dl className="space-y-2">
              {[
                { label: 'Converted to paid', value: paidCount, color: 'text-[#047857]' },
                { label: 'Still in trial', value: Math.max(trialCount - expiredTrials.length, 0), color: 'text-[#7E6036]' },
                { label: 'Expired, not converted', value: expiredTrials.length, color: 'text-[#B91C1C]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-[12px] text-[#5C5A54]">{label}</dt>
                  <dd className={`text-[13px] font-semibold tabular-nums ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
      </div>

      {/* Portal health */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} className="text-[#7E6036]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E6B63]">The four portals</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {portals.map(portal => {
            const Icon = portal.icon
            return (
              <Link
                key={portal.key}
                href={portal.href}
                className="group relative rounded-2xl border border-[#E2DCD1] bg-[#FDFCF9] overflow-hidden hover:border-[#CFC7B8] hover:shadow-[0_2px_4px_0_rgba(44,44,42,0.05),0_12px_28px_-18px_rgba(44,44,42,0.22)] transition-[border-color,box-shadow] duration-150"
              >
                <span className={`absolute inset-x-0 top-0 h-[3px] ${portal.rail}`} aria-hidden />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon size={14} className={portal.accent} />
                    <span className="text-[12px] font-medium text-[#3F3D38]">{portal.label}</span>
                    <ChevronRight size={13} className="ml-auto text-[#8A877F] group-hover:text-[#5C5A54] transition-colors duration-150" />
                  </div>
                  <p className={`text-[32px] leading-none font-semibold tabular-nums ${portal.accent}`}>{portal.headline}</p>
                  <p className="text-[11px] text-[#6E6B63] mt-1.5 mb-4">{portal.headlineLabel}</p>
                  <dl className="grid grid-cols-3 gap-2 pt-3 border-t border-[#E2DCD1]">
                    {portal.stats.map(stat => (
                      <div key={stat.label}>
                        <dd className="text-[15px] font-semibold text-[#2C2C2A] tabular-nums">{stat.value}</dd>
                        <dt className="text-[10px] text-[#6E6B63] mt-0.5 leading-tight">{stat.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Activity + recent signups */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <div className="xl:col-span-2">
          <Panel title="Live activity" icon={History} accent="text-[#0369A1]">
            <div className="max-h-[30rem] overflow-y-auto">
              <ActivityFeed events={activity as ActivityEvent[]} nowIso={nowIso} />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Recently joined" icon={Building2} accent="text-[#7E6036]" action={{ label: 'All studios', href: '/platform/studios' }}>
            {recentStudios.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[#6E6B63]">
                No studios yet. New signups appear here the moment they complete onboarding.
              </p>
            ) : (
              <ul className="divide-y divide-[#EFEBE3]">
                {(recentStudios as RecentStudioRow[]).map(studio => (
                  <li key={studio.id}>
                    <Link
                      href={`/platform/studios/${studio.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F1EDE5] transition-colors duration-150"
                    >
                      <span className="text-[13px] text-[#1A1A18] truncate">{studio.name ?? 'Unnamed studio'}</span>
                      <span className="text-[11px] text-[#6E6B63] tabular-nums shrink-0">
                        {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Churn watch" icon={UserX} accent={churnRiskOrgs.length > 0 ? 'text-[#B91C1C]' : 'text-[#047857]'}>
            <div className="p-5">
              <p className={`text-[32px] leading-none font-semibold tabular-nums ${churnRiskOrgs.length > 0 ? 'text-[#B91C1C]' : 'text-[#047857]'}`}>
                {churnRiskOrgs.length}
              </p>
              <p className="text-[11px] text-[#6E6B63] mt-1.5">
                {churnRiskOrgs.length > 0
                  ? 'paying studios with no project activity in 30+ days'
                  : 'every paying studio has been active in the last 30 days'}
              </p>
              {churnRiskOrgs.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {churnRiskOrgs.slice(0, 4).map(o => (
                    <li key={o.id}>
                      <Link
                        href={`/platform/studios/${o.id}`}
                        className="flex items-center justify-between gap-2 text-[12px] text-[#5C5A54] hover:text-[#1A1A18] transition-colors duration-150"
                      >
                        <span className="truncate">{o.name ?? 'Unnamed studio'}</span>
                        <span className="text-[#6E6B63] capitalize shrink-0">{o.plan ?? '—'}</span>
                      </Link>
                    </li>
                  ))}
                  {churnRiskOrgs.length > 4 && (
                    <li>
                      <Link href="/platform/studios" className="text-[11px] text-[#7E6036] hover:text-[#5F4726] transition-colors duration-150">
                        +{churnRiskOrgs.length - 4} more →
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Feature adoption */}
      <Panel title="Feature adoption" icon={Zap} accent="text-[#7E6036]">
        <div className="p-5">
          <p className="text-[11px] text-[#6E6B63] mb-4">Across all {billableOrgs.length} billable studios</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { label: 'Have created a project', pct: projectAdoptionPct, count: orgsWithProjects.size, bar: 'bg-[#047857]', icon: FolderOpen },
              { label: 'Using sourcing / price requests', pct: sourcingAdoptionPct, count: orgsWithSourcing.size, bar: 'bg-[#7E6036]', icon: BookOpen },
            ].map(({ label, pct, count, bar, icon: Icon }) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={12} className="text-[#6E6B63]" />
                  <span className="text-[12px] text-[#5C5A54]">{label}</span>
                  <span className="ml-auto text-[12px] font-semibold text-[#1A1A18] tabular-nums">
                    {count} <span className="text-[#6E6B63] font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-[#E9E4DA] rounded-full overflow-hidden">
                  <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Footnote: the remaining raw counters, kept honest and out of the way */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#6E6B63]">
        <span className="flex items-center gap-1.5"><Building2 size={12} /> {(studioCount ?? 0).toLocaleString()} studios on record</span>
        <span className="flex items-center gap-1.5"><Users size={12} /> {(userCount ?? 0).toLocaleString()} active members</span>
        <span className="flex items-center gap-1.5"><FolderOpen size={12} /> {(projectCount ?? 0).toLocaleString()} projects</span>
        <span className="flex items-center gap-1.5"><MessageSquare size={12} /> {(unreadCount ?? 0).toLocaleString()} unread</span>
        <span className="flex items-center gap-1.5 ml-auto"><Activity size={12} /> Figures cached for 5 minutes</span>
      </div>
    </div>
  )
}
