export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ArrowLeftRight, CheckCircle2, Clock, DollarSign, AlertCircle } from 'lucide-react'

function fmt(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
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
  unlinked:    { label: 'No project',   color: '#52525B' },
  pending:     { label: 'Pending',      color: '#71717A' },
  due:         { label: 'Fee due',      color: '#F59E0B' },
  collectible: { label: 'Collectible',  color: '#34D399' },
}

function getFeeStatus(projectStatus: string | null): keyof typeof FEE_STATUS {
  if (!projectStatus) return 'unlinked'
  if (['Paid', 'Completed'].includes(projectStatus)) return 'collectible'
  if (projectStatus === 'Invoice') return 'due'
  return 'pending'
}

export default async function PlatformSourcingPage() {
  // Fetch all accepted assignments with full context
  const { data: assignments } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select(`
      id, accepted_at,
      response:sourcing_item_responses(unit_price, lead_time_weeks),
      item:sourcing_session_items(title, session:sourcing_sessions(id, title, user_id, project_id, project:projects(project_name, status))),
      supplier:sourcing_session_suppliers(supplier_name, email)
    `)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })

  // Also fetch all sessions for the pipeline overview
  const { data: sessions } = await supabaseAdmin
    .from('sourcing_sessions')
    .select('id, title, status, created_at, user_id, project:projects(project_name, status)')
    .order('created_at', { ascending: false })
    .limit(200)

  // Get unique user_ids for studio name lookup
  const userIds = [...new Set([
    ...(assignments ?? []).map((a: any) => {
      const item = Array.isArray(a.item) ? a.item[0] : a.item
      const session = Array.isArray(item?.session) ? item?.session[0] : item?.session
      return session?.user_id
    }),
    ...(sessions ?? []).map((s: any) => s.user_id),
  ].filter(Boolean))]

  const studioMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('user_id, business_name')
      .in('user_id', userIds)
    for (const s of settingsRows ?? []) {
      if (s.user_id) studioMap[s.user_id] = s.business_name ?? 'Studio'
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
      id: a.id,
      accepted_at: a.accepted_at,
      item_title: item?.title ?? '—',
      session_title: session?.title ?? '—',
      session_id: session?.id ?? null,
      supplier_name: supplier?.supplier_name ?? '—',
      unit_price: unitPrice,
      fee: unitPrice * 0.01,
      project_name: project?.project_name ?? null,
      project_status: project?.status ?? null,
      fee_status: feeStatus,
      studio: studioMap[session?.user_id] ?? 'Studio',
    }
  })

  // Stats
  const totalFee = items.reduce((s, i) => s + i.fee, 0)
  const feeDue = items.filter(i => i.fee_status === 'due').reduce((s, i) => s + i.fee, 0)
  const feeCollectible = items.filter(i => i.fee_status === 'collectible').reduce((s, i) => s + i.fee, 0)

  // Session pipeline stats
  const sessionsByStatus = (sessions ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ArrowLeftRight size={18} className="text-[#C4A46B]" />
          <h1 className="font-serif text-3xl text-white">Sourcing Pipeline</h1>
        </div>
        <p className="text-sm text-white/40">Price requests, accepted items &amp; 1% platform fee tracker</p>
      </div>

      {/* Fee summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Accepted items', value: items.length.toString(), icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Total fee value', value: fmt(totalFee), icon: DollarSign, color: 'text-[#C4A46B]' },
          { label: 'Fee due (Invoice)', value: fmt(feeDue), icon: AlertCircle, color: 'text-amber-400' },
          { label: 'Collectible (Paid)', value: fmt(feeCollectible), icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Session pipeline */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={14} className="text-[#C4A46B]" />
          <h2 className="text-sm font-medium text-white">Session Pipeline</h2>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          {[
            { key: 'draft', label: 'Draft', color: '#71717A' },
            { key: 'sent', label: 'Sent', color: '#60A5FA' },
            { key: 'in_progress', label: 'In Progress', color: '#F59E0B' },
            { key: 'completed', label: 'Completed', color: '#34D399' },
            { key: 'archived', label: 'Archived', color: '#52525B' },
          ].map(({ key, label, color }) => (
            <div key={key} className="text-center">
              <p className="text-2xl font-semibold text-white">{sessionsByStatus[key] ?? 0}</p>
              <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Accepted items table */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">Accepted Items &amp; Fee Tracker</h2>
          <p className="text-xs text-white/30 mt-0.5">All items accepted by designers from supplier quotes</p>
        </div>

        {items.length === 0 ? (
          <p className="px-5 py-10 text-sm text-white/30 text-center">No accepted items yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Studio', 'Session', 'Item', 'Supplier', 'Price', '1% Fee', 'Project', 'Proj. Status', 'Fee Status', 'Accepted'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map(item => {
                  const psBadge = item.project_status ? (PROJECT_STATUS_BADGE[item.project_status] ?? PROJECT_STATUS_BADGE.Draft) : null
                  const fsBadge = FEE_STATUS[item.fee_status]
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{item.studio}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap max-w-[160px] truncate">
                        {item.session_id ? (
                          <a href={`/sourcing/${item.session_id}`} className="text-[#C4A46B] hover:underline" target="_blank" rel="noreferrer">
                            {item.session_title}
                          </a>
                        ) : item.session_title}
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap max-w-[160px] truncate font-medium">{item.item_title}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{item.supplier_name}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap font-mono">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-[#C4A46B] whitespace-nowrap font-mono font-semibold">{fmt(item.fee)}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{item.project_name ?? <span className="text-white/20">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {psBadge ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: psBadge.bg, color: psBadge.color }}>
                            {psBadge.label}
                          </span>
                        ) : <span className="text-white/20 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium" style={{ color: fsBadge.color }}>{fsBadge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">
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
    </div>
  )
}
