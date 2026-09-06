export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CheckCircle2, Clock, Mail, AlertTriangle, ArrowLeftRight, BarChart3, Building2, Package } from 'lucide-react'
import { one, type Embedded } from '@/lib/supabase/embed'

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
  Draft:      { label: 'Draft',         bg: '#EFEBE3', color: '#5C5A54' },
  Quote:      { label: 'Quote',         bg: '#DDEDFA', color: '#0369A1' },
  Approved:   { label: 'Approved',      bg: '#D6F5E3', color: '#047857' },
  Deposit:    { label: 'Deposit Paid',  bg: '#EAE4FD', color: '#6D28D9' },
  Invoice:    { label: 'Invoice',       bg: '#FBEFD2', color: '#8F5706' },
  Paid:       { label: 'Paid',          bg: '#D6F5E3', color: '#047857' },
  Completed:  { label: 'Completed',     bg: '#D6F5E3', color: '#047857' },
  Cancelled:  { label: 'Cancelled',     bg: '#FBE0E0', color: '#B91C1C' },
}

const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  pending:     '#5C5A54',
  viewed:      '#0369A1',
  in_progress: '#8F5706',
  responded:   '#047857',
  completed:   '#047857',
  declined:    '#B91C1C',
}

// Shapes of the four sourcing queries above. Embedded relations come back as
// object-or-array, which is what `one()` unwraps and what the `as any` on each
// map callback used to hide.
interface SourcingSessionRef {
  id: string
  title: string | null
  org_id: string | null
  project_id?: string | null
  project?: Embedded<{ project_name: string | null; status: string | null }>
}
interface AssignmentRow {
  id: string
  accepted_at: string | null
  response: Embedded<{ unit_price: number | null; lead_time_weeks: number | null }>
  item: Embedded<{ title: string | null; session: Embedded<SourcingSessionRef> }>
  supplier: Embedded<{ supplier_name: string | null; email: string | null }>
}
interface SessionRow {
  id: string
  title: string | null
  status: string | null
  created_at: string
  org_id: string | null
  project: Embedded<{ project_name: string | null; status: string | null }>
}
interface SupplierSendRow {
  id: string
  supplier_name: string | null
  email: string | null
  sent_at: string | null
  status: string | null
  session: Embedded<SourcingSessionRef>
}

export default async function PlatformSourcingPage() {
  // Server component: renders once per request, so reading the clock here is stable by construction.
  // eslint-disable-next-line react-hooks/purity
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  const { data: assignments } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select(`
      id, accepted_at,
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

  const assignmentRows  = (assignments    ?? []) as unknown as AssignmentRow[]
  const sessionRows     = (sessions       ?? []) as unknown as SessionRow[]
  const staleRows_      = (staleSuppliers ?? []) as unknown as SupplierSendRow[]
  const recentSendRows  = (recentSends    ?? []) as unknown as SupplierSendRow[]

  // Studio name lookup keyed by org_id
  const orgIds = [...new Set([
    ...assignmentRows.map(a => one(one(a.item)?.session)?.org_id),
    ...sessionRows.map(s => s.org_id),
    ...staleRows_.map(s => one(s.session)?.org_id),
    ...recentSendRows.map(s => one(s.session)?.org_id),
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
  const items = assignmentRows.map(a => {
    const response = one(a.response)
    const item = one(a.item)
    const session = one(item?.session)
    const project = one(session?.project)
    const supplier = one(a.supplier)
    const unitPrice = response?.unit_price ?? 0
    return {
      id: a.id as string,
      accepted_at: a.accepted_at as string,
      item_title: item?.title ?? '—',
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      supplier_name: (supplier?.supplier_name ?? '—') as string,
      supplier_email: (supplier?.email ?? '') as string,
      unit_price: unitPrice as number,
      project_name: project?.project_name ?? null,
      project_status: project?.status ?? null,
      studio: studioMap[session?.org_id ?? ''] ?? '—',
    }
  })

  // Normalise stale suppliers
  const staleRows = staleRows_.map(s => {
    const session = one(s.session)
    return {
      id: s.id,
      supplier_name: s.supplier_name,
      email: s.email,
      sent_at: s.sent_at,
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      studio: studioMap[session?.org_id ?? ''] ?? '—',
    }
  })

  // Normalise email log
  const emailLog = recentSendRows.map(s => {
    const session = one(s.session)
    return {
      id: s.id,
      supplier_name: s.supplier_name,
      email: s.email,
      sent_at: s.sent_at,
      status: s.status as string,
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      studio: studioMap[session?.org_id ?? ''] ?? '—',
    }
  })

  // Volume flowing through sourcing — the platform charges nothing on it,
  // but it is the measure of whether studios actually use the price flow.
  const acceptedValue   = items.reduce((s, i) => s + i.unit_price, 0)
  const studiosUsing    = new Set([...items.map(i => i.studio), ...sessionRows.map(r => studioMap[r.org_id ?? ''] ?? '—')].filter(v => v !== '—')).size
  const suppliersWon    = new Set(items.map(i => i.supplier_email || i.supplier_name).filter(Boolean)).size

  // Session pipeline stats
  const sessionsByStatus = (sessions ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">

      {/* ── Page header ─────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-[#1A1A18]">Price Requests</h1>
          <p className="text-sm text-[#6E6B63] mt-1">RFQ delivery, supplier responses and accepted items · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8A877F]">
          <ArrowLeftRight size={13} />
          <span>{(sessions ?? []).length} sessions · {items.length} accepted items</span>
        </div>
      </div>

      {/* ── KPI tiles ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {[
          {
            label: 'Awaiting response',
            value: staleRows.length.toString(),
            sub: 'invitations silent 7 days+',
            icon: AlertTriangle,
            valueColor: staleRows.length > 0 ? 'text-[#8F5706]' : 'text-[#1A1A18]',
            border: staleRows.length > 0 ? 'border-amber-200' : 'border-[#E2DCD1]',
          },
          {
            label: 'Sessions',
            value: sessionRows.length.toString(),
            sub: 'most recent 200',
            icon: ArrowLeftRight,
            valueColor: 'text-[#1A1A18]',
            border: 'border-[#E2DCD1]',
          },
          {
            label: 'Accepted items',
            value: items.length.toString(),
            sub: 'supplier quotes selected',
            icon: BarChart3,
            valueColor: 'text-[#1A1A18]',
            border: 'border-[#E2DCD1]',
          },
          {
            label: 'Value accepted',
            value: fmt(acceptedValue),
            sub: 'across all accepted items',
            icon: CheckCircle2,
            valueColor: 'text-[#7E6036]',
            border: 'border-[#E2DCD1]',
          },
          {
            label: 'Studios · suppliers',
            value: `${studiosUsing} · ${suppliersWon}`,
            sub: 'using it · winning work',
            icon: Building2,
            valueColor: 'text-[#1A1A18]',
            border: 'border-[#E2DCD1]',
          },
        ].map(({ label, value, sub, icon: Icon, valueColor, border }) => (
          <div key={label} className={`bg-[#FDFCF9] border ${border} rounded-xl p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6B63]">{label}</span>
              <Icon size={13} className="text-[#8A877F]" />
            </div>
            <p className={`text-xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
            <p className="text-[10px] text-[#6E6B63] mt-1 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Session pipeline + Stale invitations side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

        {/* Session pipeline */}
        <div className="bg-[#FDFCF9] border border-[#E2DCD1] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={13} className="text-[#6E6B63]" />
            <h2 className="text-sm font-semibold text-[#1A1A18]">Session Pipeline</h2>
            <span className="text-xs text-[#8A877F] ml-1">· {(sessions ?? []).length} total</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'draft',       label: 'Draft',       color: '#5C5A54' },
              { key: 'sent',        label: 'Sent',        color: '#0369A1' },
              { key: 'in_progress', label: 'In Progress', color: '#8F5706' },
              { key: 'completed',   label: 'Completed',   color: '#047857' },
              { key: 'archived',    label: 'Archived',    color: '#6E6B63' },
            ].map(({ key, label, color }) => (
              <div key={key} className="bg-[#F1EDE5] rounded-lg px-3 py-3 text-center">
                <p className="text-2xl font-bold text-[#1A1A18] tabular-nums">{sessionsByStatus[key] ?? 0}</p>
                <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider" style={{ color }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stale invitations */}
        <div className={`bg-[#FDFCF9] rounded-xl overflow-hidden border ${staleRows.length > 0 ? 'border-amber-200' : 'border-[#E2DCD1]'}`}>
          <div className="px-5 py-4 border-b border-[#EAE5DB] flex items-center gap-2">
            <AlertTriangle size={13} className={staleRows.length > 0 ? 'text-[#8F5706]' : 'text-[#8A877F]'} />
            <h2 className="text-sm font-semibold text-[#1A1A18]">Stale Invitations</h2>
            {staleRows.length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-[#8F5706] ml-1">{staleRows.length}</span>
            ) : (
              <span className="text-xs text-[#8A877F] ml-1">None</span>
            )}
            <span className="text-[10px] text-[#8A877F] ml-1 hidden sm:inline">Sent &gt;7 days · no response</span>
          </div>
          {staleRows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 size={16} className="text-[#047857]/30 mx-auto mb-1.5" />
              <p className="text-xs text-[#8A877F]">All invitations responded to</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[34rem]">
                <thead>
                  <tr className="border-b border-[#EAE5DB]">
                    {['Studio', 'Session', 'Supplier', 'Sent', 'Waiting'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A877F] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE3]">
                  {staleRows.map(row => (
                    <tr key={row.id} className="hover:bg-[#F1EDE5] transition-colors">
                      <td className="px-4 py-2.5 text-[#6E6B63] whitespace-nowrap text-xs">{row.studio}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                        {row.session_id ? (
                          <a href={`/sourcing/${row.session_id}`} className="text-[#7E6036] hover:underline" target="_blank" rel="noreferrer">{row.session_title}</a>
                        ) : <span className="text-[#6E6B63]">{row.session_title}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[#3F3D38] whitespace-nowrap text-xs">{row.supplier_name}</td>
                      <td className="px-4 py-2.5 text-[#6E6B63] whitespace-nowrap text-xs">{row.sent_at ? fmtDate(row.sent_at) : '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-[#8F5706]">{row.sent_at ? daysSince(row.sent_at) : '—'}d</span>
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Accepted Items</p>
      </div>
      <div className="bg-[#FDFCF9] border border-[#E2DCD1] rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-[#E2DCD1] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A18]">All Accepted Items</h2>
            <p className="text-xs text-[#6E6B63] mt-0.5">Items accepted from supplier quotes · {items.length} total</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[#6E6B63] text-center">No accepted items yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[52rem]">
              <thead>
                <tr className="border-b border-[#E2DCD1]">
                  {['Studio', 'Session', 'Item', 'Supplier', 'Price', 'Project', 'Status', 'Accepted'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6E6B63] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {items.map(item => {
                  const psBadge = item.project_status ? (PROJECT_STATUS_BADGE[item.project_status] ?? PROJECT_STATUS_BADGE.Draft) : null
                  return (
                    <tr key={item.id} className="hover:bg-[#F5F2EC] transition-colors">
                      <td className="px-4 py-3 text-[#5C5A54] whitespace-nowrap text-xs">{item.studio}</td>
                      <td className="px-4 py-3 text-[#5C5A54] whitespace-nowrap max-w-[140px] truncate text-xs">
                        {item.session_id ? (
                          <a href={`/sourcing/${item.session_id}`} className="text-[#7E6036] hover:underline" target="_blank" rel="noreferrer">
                            {item.session_title}
                          </a>
                        ) : item.session_title}
                      </td>
                      <td className="px-4 py-3 text-[#1A1A18] whitespace-nowrap max-w-[150px] truncate font-medium text-xs">{item.item_title}</td>
                      <td className="px-4 py-3 text-[#3F3D38] whitespace-nowrap text-xs">{item.supplier_name}</td>
                      <td className="px-4 py-3 text-[#1A1A18] whitespace-nowrap font-mono text-xs">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-[#5C5A54] whitespace-nowrap text-xs">{item.project_name ?? <span className="text-[#8A877F]">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {psBadge ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: psBadge.bg, color: psBadge.color }}>
                            {psBadge.label}
                          </span>
                        ) : <span className="text-[#8A877F] text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#6E6B63] whitespace-nowrap text-xs">
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Email Log</p>
      </div>
      <div className="bg-[#FDFCF9] border border-[#E2DCD1] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2DCD1] flex items-center gap-2">
          <Mail size={13} className="text-[#6E6B63]" />
          <h2 className="text-sm font-semibold text-[#1A1A18]">Supplier Invitations</h2>
          <p className="text-xs text-[#8A877F] ml-2">Most recent first</p>
        </div>
        {emailLog.length === 0 ? (
          <p className="px-6 py-10 text-sm text-[#6E6B63] text-center">No emails sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[40rem]">
              <thead>
                <tr className="border-b border-[#EAE5DB]">
                  {['Studio', 'Session', 'Supplier', 'Email', 'Sent', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A877F] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {emailLog.map(row => (
                  <tr key={row.id} className="hover:bg-[#F5F2EC] transition-colors">
                    <td className="px-4 py-2.5 text-[#6E6B63] whitespace-nowrap text-xs">{row.studio}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap max-w-[140px] truncate text-xs">
                      {row.session_id ? (
                        <a href={`/sourcing/${row.session_id}`} className="text-[#7E6036] hover:underline" target="_blank" rel="noreferrer">{row.session_title}</a>
                      ) : <span className="text-[#6E6B63]">{row.session_title}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[#3F3D38] whitespace-nowrap text-xs">{row.supplier_name}</td>
                    <td className="px-4 py-2.5 text-[#6E6B63] whitespace-nowrap text-xs">{row.email}</td>
                    <td className="px-4 py-2.5 text-[#6E6B63] whitespace-nowrap text-xs">{row.sent_at ? fmtDate(row.sent_at) : '—'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] font-semibold capitalize" style={{ color: SUPPLIER_STATUS_COLOR[row.status] ?? '#5C5A54' }}>
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
