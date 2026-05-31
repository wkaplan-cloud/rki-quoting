export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CheckCircle2, Clock, DollarSign, AlertCircle, Mail, AlertTriangle, TrendingUp, ArrowLeftRight, BarChart3 } from 'lucide-react'
import { SourcingFeeTracker } from './SourcingFeeTracker'
import type { CollectibleItem } from './SourcingFeeTracker'

function fmt(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

const PROJECT_STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  Draft:      { label: 'Draft',      bg: '#1A1A18', color: '#71717A' },
  Quote:      { label: 'Quote',      bg: '#1C2A3A', color: '#60A5FA' },
  Invoice:    { label: 'Invoice',    bg: '#2A1F0A', color: '#F59E0B' },
  Paid:       { label: 'Paid',       bg: '#0A2A1A', color: '#34D399' },
  Completed:  { label: 'Completed',  bg: '#0A2A1A', color: '#34D399' },
  Cancelled:  { label: 'Cancelled',  bg: '#2A0A0A', color: '#F87171' },
}

const FEE_STATUS: Record<string, { label: string; color: string }> = {
  unlinked:    { label: 'No project',    color: '#52525B' },
  pending:     { label: 'Pending',       color: '#71717A' },
  due:         { label: 'Fee due',       color: '#F59E0B' },
  collectible: { label: 'Outstanding',   color: '#C4A46B' },
  collected:   { label: 'Collected ✓',   color: '#34D399' },
}

const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  pending:     '#71717A',
  viewed:      '#60A5FA',
  in_progress: '#F59E0B',
  responded:   '#34D399',
  completed:   '#34D399',
  declined:    '#F87171',
}

function getFeeStatus(projectStatus: string | null): 'unlinked' | 'pending' | 'due' | 'collectible' {
  if (!projectStatus) return 'unlinked'
  if (['Paid', 'Completed'].includes(projectStatus)) return 'collectible'
  if (projectStatus === 'Invoice') return 'due'
  return 'pending'
}

export default async function PlatformSourcingPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  const { data: assignments } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select(`
      id, accepted_at, fee_collected_at,
      response:sourcing_item_responses(unit_price, lead_time_weeks),
      item:sourcing_session_items(title, session:sourcing_sessions(id, title, org_id, project_id, project:projects(project_name, status))),
      supplier:sourcing_session_suppliers(supplier_name, email)
    `)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })

  const { data: sessions } = await supabaseAdmin
    .from('sourcing_sessions')
    .select('id, title, status, created_at, org_id, project:projects(project_name, status)')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: staleSuppliers } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, email, sent_at, status, session:sourcing_sessions(id, title, org_id)')
    .eq('status', 'pending')
    .not('sent_at', 'is', null)
    .lt('sent_at', sevenDaysAgo)
    .order('sent_at', { ascending: true })
    .limit(100)

  const { data: recentSends } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, email, sent_at, status, session:sourcing_sessions(id, title, org_id)')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(80)

  // Studio name lookup keyed by org_id
  const orgIds = [...new Set([
    ...(assignments ?? []).map((a: any) => {
      const item = Array.isArray(a.item) ? a.item[0] : a.item
      const session = Array.isArray(item?.session) ? item?.session[0] : item?.session
      return session?.org_id
    }),
    ...(sessions ?? []).map((s: any) => s.org_id),
    ...(staleSuppliers ?? []).map((s: any) => {
      const session = Array.isArray(s.session) ? s.session[0] : s.session
      return session?.org_id
    }),
    ...(recentSends ?? []).map((s: any) => {
      const session = Array.isArray(s.session) ? s.session[0] : s.session
      return session?.org_id
    }),
  ].filter(Boolean))]

  const studioMap: Record<string, string> = {}
  if (orgIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('org_id, business_name')
      .in('org_id', orgIds)
    for (const s of settingsRows ?? []) {
      if (s.org_id) studioMap[s.org_id] = s.business_name ?? '—'
    }
  }

  // Normalise accepted items
  const items = (assignments ?? []).map((a: any) => {
    const response = Array.isArray(a.response) ? a.response[0] : a.response
    const item = Array.isArray(a.item) ? a.item[0] : a.item
    const session = Array.isArray(item?.session) ? item?.session[0] : item?.session
    const project = Array.isArray(session?.project) ? session?.project[0] : session?.project
    const supplier = Array.isArray(a.supplier) ? a.supplier[0] : a.supplier
    const unitPrice = response?.unit_price ?? 0
    const feeStatus = getFeeStatus(project?.status ?? null)
    return {
      id: a.id as string,
      accepted_at: a.accepted_at as string,
      fee_collected_at: a.fee_collected_at as string | null,
      item_title: item?.title ?? '—',
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      supplier_name: (supplier?.supplier_name ?? '—') as string,
      supplier_email: (supplier?.email ?? '') as string,
      unit_price: unitPrice as number,
      fee: unitPrice * 0.01 as number,
      project_name: project?.project_name ?? null,
      project_status: project?.status ?? null,
      fee_status: feeStatus,
      studio: studioMap[session?.org_id] ?? '—',
    }
  })

  // Normalise stale suppliers
  const staleRows = (staleSuppliers ?? []).map((s: any) => {
    const session = Array.isArray(s.session) ? s.session[0] : s.session
    return {
      id: s.id,
      supplier_name: s.supplier_name,
      email: s.email,
      sent_at: s.sent_at,
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      studio: studioMap[session?.org_id] ?? '—',
    }
  })

  // Normalise email log
  const emailLog = (recentSends ?? []).map((s: any) => {
    const session = Array.isArray(s.session) ? s.session[0] : s.session
    return {
      id: s.id,
      supplier_name: s.supplier_name,
      email: s.email,
      sent_at: s.sent_at,
      status: s.status as string,
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      studio: studioMap[session?.org_id] ?? '—',
    }
  })

  // Fee stats
  const totalFeeValue   = items.reduce((s, i) => s + i.fee, 0)
  const feeDue          = items.filter(i => i.fee_status === 'due').reduce((s, i) => s + i.fee, 0)
  const feeOutstanding  = items.filter(i => i.fee_status === 'collectible' && !i.fee_collected_at).reduce((s, i) => s + i.fee, 0)
  const feeCollected    = items.filter(i => i.fee_collected_at).reduce((s, i) => s + i.fee, 0)
  const suppliersOwing  = new Set(items.filter(i => i.fee_status === 'collectible' && !i.fee_collected_at).map(i => i.supplier_email || i.supplier_name)).size

  // Session pipeline stats
  const sessionsByStatus = (sessions ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  // Items where fee is collectible — passed to interactive fee tracker
  const collectibleItems: CollectibleItem[] = items
    .filter(i => i.fee_status === 'collectible')
    .map(i => ({
      id: i.id,
      supplier_name: i.supplier_name,
      supplier_email: i.supplier_email,
      fee: i.fee,
      fee_collected_at: i.fee_collected_at,
    }))

  return (
    <div className="p-8 max-w-[1400px]">

      {/* ── Page header ─────────────────────────────── */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-1">QuotingHub</p>
          <h1 className="font-serif text-3xl text-white">Platform Admin</h1>
          <p className="text-sm text-white/35 mt-1">Sourcing activity · 1% fee tracking · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/20">
          <ArrowLeftRight size={13} />
          <span>{(sessions ?? []).length} sessions · {items.length} accepted items</span>
        </div>
      </div>

      {/* ── KPI tiles ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          {
            label: 'Outstanding',
            value: fmt(feeOutstanding),
            sub: `${suppliersOwing} supplier${suppliersOwing !== 1 ? 's' : ''} owing`,
            icon: TrendingUp,
            valueColor: feeOutstanding > 0 ? 'text-amber-400' : 'text-white',
            border: feeOutstanding > 0 ? 'border-amber-500/20' : 'border-white/8',
          },
          {
            label: 'Fee due',
            value: fmt(feeDue),
            sub: 'invoice raised, not yet paid',
            icon: AlertCircle,
            valueColor: feeDue > 0 ? 'text-amber-300' : 'text-white',
            border: 'border-white/8',
          },
          {
            label: 'Collected',
            value: fmt(feeCollected),
            sub: 'received to date',
            icon: CheckCircle2,
            valueColor: 'text-emerald-400',
            border: 'border-white/8',
          },
          {
            label: 'Total fee value',
            value: fmt(totalFeeValue),
            sub: 'across all accepted items',
            icon: DollarSign,
            valueColor: 'text-[#C4A46B]',
            border: 'border-white/8',
          },
          {
            label: 'Accepted items',
            value: items.length.toString(),
            sub: 'supplier quotes selected',
            icon: BarChart3,
            valueColor: 'text-white',
            border: 'border-white/8',
          },
        ].map(({ label, value, sub, icon: Icon, valueColor, border }) => (
          <div key={label} className={`bg-[#1A1A18] border ${border} rounded-xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</span>
              <Icon size={13} className="text-white/20" />
            </div>
            <p className={`text-xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
            <p className="text-[10px] text-white/25 mt-1 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── 1% Fee collection — hero section ─────────── */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">Fee Collection</p>
      </div>
      <div className="mb-8">
        <SourcingFeeTracker items={collectibleItems} />
        {collectibleItems.length === 0 && (
          <div className="bg-[#1A1A18] border border-white/8 rounded-xl px-6 py-10 text-center">
            <CheckCircle2 size={20} className="text-emerald-400/40 mx-auto mb-2" />
            <p className="text-sm text-white/30">No fees ready to collect yet</p>
            <p className="text-xs text-white/15 mt-1">Fees become collectible when the linked project is marked Paid or Completed</p>
          </div>
        )}
      </div>

      {/* ── Session pipeline + Stale invitations side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

        {/* Session pipeline */}
        <div className="bg-[#1A1A18] border border-white/8 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={13} className="text-white/30" />
            <h2 className="text-sm font-semibold text-white">Session Pipeline</h2>
            <span className="text-xs text-white/20 ml-1">· {(sessions ?? []).length} total</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'draft',       label: 'Draft',       color: '#52525B' },
              { key: 'sent',        label: 'Sent',        color: '#60A5FA' },
              { key: 'in_progress', label: 'In Progress', color: '#F59E0B' },
              { key: 'completed',   label: 'Completed',   color: '#34D399' },
              { key: 'archived',    label: 'Archived',    color: '#3F3F46' },
            ].map(({ key, label, color }) => (
              <div key={key} className="bg-white/[0.03] rounded-lg px-3 py-3 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{sessionsByStatus[key] ?? 0}</p>
                <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider" style={{ color }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stale invitations */}
        <div className={`bg-[#1A1A18] rounded-xl overflow-hidden border ${staleRows.length > 0 ? 'border-amber-500/20' : 'border-white/8'}`}>
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
            <AlertTriangle size={13} className={staleRows.length > 0 ? 'text-amber-400' : 'text-white/20'} />
            <h2 className="text-sm font-semibold text-white">Stale Invitations</h2>
            {staleRows.length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 ml-1">{staleRows.length}</span>
            ) : (
              <span className="text-xs text-white/20 ml-1">None</span>
            )}
            <span className="text-[10px] text-white/20 ml-1 hidden sm:inline">Sent &gt;7 days · no response</span>
          </div>
          {staleRows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 size={16} className="text-emerald-400/30 mx-auto mb-1.5" />
              <p className="text-xs text-white/20">All invitations responded to</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Studio', 'Session', 'Supplier', 'Sent', 'Waiting'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {staleRows.map(row => (
                    <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5 text-white/40 whitespace-nowrap text-xs">{row.studio}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                        {row.session_id ? (
                          <a href={`/sourcing/${row.session_id}`} className="text-[#C4A46B] hover:underline" target="_blank" rel="noreferrer">{row.session_title}</a>
                        ) : <span className="text-white/40">{row.session_title}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-white/70 whitespace-nowrap text-xs">{row.supplier_name}</td>
                      <td className="px-4 py-2.5 text-white/30 whitespace-nowrap text-xs">{row.sent_at ? fmtDate(row.sent_at) : '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-amber-400">{row.sent_at ? daysSince(row.sent_at) : '—'}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Accepted items table ──────────────────────── */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">Accepted Items</p>
      </div>
      <div className="bg-[#1A1A18] border border-white/8 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">All Accepted Items</h2>
            <p className="text-xs text-white/25 mt-0.5">Items accepted from supplier quotes · {items.length} total</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="px-6 py-10 text-sm text-white/25 text-center">No accepted items yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {['Studio', 'Session', 'Item', 'Supplier', 'Price', '1% Fee', 'Project', 'Status', 'Fee Status', 'Accepted'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/25 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {items.map(item => {
                  const psBadge = item.project_status ? (PROJECT_STATUS_BADGE[item.project_status] ?? PROJECT_STATUS_BADGE.Draft) : null
                  const displayStatus = item.fee_collected_at ? 'collected' : item.fee_status
                  const fsBadge = FEE_STATUS[displayStatus]
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap text-xs">{item.studio}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap max-w-[140px] truncate text-xs">
                        {item.session_id ? (
                          <a href={`/sourcing/${item.session_id}`} className="text-[#C4A46B] hover:underline" target="_blank" rel="noreferrer">
                            {item.session_title}
                          </a>
                        ) : item.session_title}
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap max-w-[150px] truncate font-medium text-xs">{item.item_title}</td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap text-xs">{item.supplier_name}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap font-mono text-xs">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-[#C4A46B] whitespace-nowrap font-mono font-semibold text-xs">{fmt(item.fee)}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap text-xs">{item.project_name ?? <span className="text-white/20">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {psBadge ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: psBadge.bg, color: psBadge.color }}>
                            {psBadge.label}
                          </span>
                        ) : <span className="text-white/20 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold" style={{ color: fsBadge.color }}>{fsBadge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-white/30 whitespace-nowrap text-xs">
                        {item.accepted_at ? fmtDate(item.accepted_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Email delivery log ────────────────────────── */}
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">Email Log</p>
      </div>
      <div className="bg-[#1A1A18] border border-white/8 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/8 flex items-center gap-2">
          <Mail size={13} className="text-white/30" />
          <h2 className="text-sm font-semibold text-white">Supplier Invitations</h2>
          <p className="text-xs text-white/20 ml-2">Most recent first</p>
        </div>
        {emailLog.length === 0 ? (
          <p className="px-6 py-10 text-sm text-white/25 text-center">No emails sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Studio', 'Session', 'Supplier', 'Email', 'Sent', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/20 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {emailLog.map(row => (
                  <tr key={row.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-2.5 text-white/40 whitespace-nowrap text-xs">{row.studio}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[140px] truncate text-xs">
                      {row.session_id ? (
                        <a href={`/sourcing/${row.session_id}`} className="text-[#C4A46B] hover:underline" target="_blank" rel="noreferrer">{row.session_title}</a>
                      ) : <span className="text-white/40">{row.session_title}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-white/70 whitespace-nowrap text-xs">{row.supplier_name}</td>
                    <td className="px-4 py-2.5 text-white/35 whitespace-nowrap text-xs">{row.email}</td>
                    <td className="px-4 py-2.5 text-white/25 whitespace-nowrap text-xs">{row.sent_at ? fmtDate(row.sent_at) : '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] font-semibold capitalize" style={{ color: SUPPLIER_STATUS_COLOR[row.status] ?? '#71717A' }}>
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
