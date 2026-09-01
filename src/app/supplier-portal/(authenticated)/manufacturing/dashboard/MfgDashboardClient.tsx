'use client'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { useNow } from '@/lib/useNow'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', bg: '#F5F7F9' }

function fmtR(n: number) { return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function pct(a: number, b: number) { if (b === 0) return null; return ((a - b) / b * 100).toFixed(0) }

interface DashData {
  kpis: { invoicedThisMonth: number; invoicedLastMonth: number; receivedThisMonth: number; receivedLastMonth: number; pipelineValue: number; pipelineCount: number }
  attention: { type: string; entity_type: string; entity_id: string; entity_number: string; client_name: string; job_name: string; value: number; days: number }[]
  recentInvoices: { id: string; invoice_number: string; total: number; amount_paid: number; status: string; due_date: string | null; job?: { job_name?: string; client?: { client_name?: string } | null } | null }[]
  openQuotes: { id: string; quote_number: string; total: number; status: string; sent_at: string | null; valid_until: string | null; job?: { job_name?: string; client?: { client_name?: string } | null } | null }[]
  monthlyRevenue: { month: string; invoiced: number; received: number }[]
}

function KPICard({ label, value, prev, isCurrency = true }: { label: string; value: number; prev: number; isCurrency?: boolean }) {
  const change = pct(value, prev)
  const up = change !== null && parseFloat(change) > 0
  const down = change !== null && parseFloat(change) < 0
  return (
    <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: S.text }}>{isCurrency ? fmtR(value) : value}</p>
      {change !== null && (
        <div className="flex items-center gap-1 mt-2">
          {up && <TrendingUp size={12} style={{ color: '#16A34A' }} />}
          {down && <TrendingDown size={12} style={{ color: '#DC2626' }} />}
          <span className="text-xs" style={{ color: up ? '#16A34A' : down ? '#DC2626' : S.muted }}>
            {up ? '+' : ''}{change}% vs last month
          </span>
        </div>
      )}
    </div>
  )
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}
function daysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}
function ageColor(days: number) {
  if (days >= 30) return '#DC2626'
  if (days >= 14) return '#D97706'
  return '#16A34A'
}

interface Props { data: DashData | null; companyName: string }

export function MfgDashboardClient({ data, companyName }: Props) {
  const now = useNow()
  const router = useRouter()

  if (!data) return (
    <div className="text-center py-20" style={{ color: S.muted }}>
      <p className="text-sm">Could not load dashboard data. Try refreshing.</p>
    </div>
  )

  const { kpis, attention, recentInvoices, openQuotes, monthlyRevenue } = data
  const maxBar = Math.max(...monthlyRevenue.map(m => m.invoiced), 1)

  return (
    <div className="space-y-6">

      {/* Attention Required */}
      {attention.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid #FDE68A` }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ background: '#FFFBEB', borderBottom: `1px solid #FDE68A` }}>
            <AlertTriangle size={14} style={{ color: '#D97706' }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#92400E' }}>Attention Required</span>
          </div>
          <div style={{ background: S.card }}>
            {attention.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors"
                style={{ borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = S.card)}
                onClick={() => router.push(`/supplier-portal/manufacturing/${item.entity_type === 'invoice' ? 'invoices' : 'quotes'}`)}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.type === 'overdue_invoice' ? '#DC2626' : '#D97706' }} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color: S.text }}>{item.client_name}</span>
                  <span className="text-xs mx-1.5" style={{ color: S.muted }}>·</span>
                  <span className="text-xs" style={{ color: S.muted }}>{item.entity_number}</span>
                  <span className="text-xs mx-1.5" style={{ color: S.muted }}>·</span>
                  <span className="text-xs" style={{ color: S.muted }}>
                    {item.type === 'overdue_invoice' && `${item.days} days overdue`}
                    {item.type === 'expiring_quote' && `expires in ${item.days} day${item.days !== 1 ? 's' : ''}`}
                    {item.type === 'no_response_quote' && `no response — ${item.days} days`}
                  </span>
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: S.text }}>{fmtR(item.value)}</span>
                <ArrowRight size={12} style={{ color: S.muted }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {attention.length === 0 && (
        <div className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-medium" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
          ✓ All clear — no urgent items
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Invoiced This Month" value={kpis.invoicedThisMonth} prev={kpis.invoicedLastMonth} />
        <KPICard label="Cash Received" value={kpis.receivedThisMonth} prev={kpis.receivedLastMonth} />
        <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.muted }}>Pipeline</p>
          <p className="text-2xl font-bold" style={{ color: S.text }}>{fmtR(kpis.pipelineValue)}</p>
          <p className="text-xs mt-2" style={{ color: S.muted }}>{kpis.pipelineCount} open quote{kpis.pipelineCount !== 1 ? 's' : ''}</p>
        </div>
        <KPICard label="This Month Gap" value={kpis.invoicedThisMonth - kpis.receivedThisMonth} prev={kpis.invoicedLastMonth - kpis.receivedLastMonth} />
      </div>

      {/* Two columns: pipeline + invoice tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Quote Pipeline */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: S.muted }}>Quote Pipeline</h3>
            <button onClick={() => router.push('/supplier-portal/manufacturing/quotes')}
              className="text-xs" style={{ color: S.accent }}>View all →</button>
          </div>
          {openQuotes.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: S.muted }}>No open quotes</p>
          ) : (
            openQuotes.map((q, idx) => {
              const days = q.sent_at ? daysSince(q.sent_at) : null
              const expiry = q.valid_until ? daysUntil(q.valid_until) : null
              return (
                <div key={q.id} onClick={() => router.push(`/supplier-portal/manufacturing/quotes/${q.id}`)}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                  style={{ borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = S.card)}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: days !== null ? ageColor(days) : '#16A34A' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: S.text }}>
                      {q.job?.client?.client_name ?? '—'}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: S.muted }}>
                      {q.quote_number} · {q.job?.job_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold" style={{ color: S.text }}>{fmtR(q.total ?? 0)}</p>
                    <p className="text-[10px]" style={{ color: days !== null && days >= 14 ? '#D97706' : S.muted }}>
                      {q.status === 'draft' ? 'draft' : days !== null ? `${days}d ago` : '—'}
                      {expiry !== null && expiry <= 7 && ` · exp ${expiry}d`}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Invoice Tracker */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}`, background: S.card }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: S.muted }}>Outstanding Invoices</h3>
            <button onClick={() => router.push('/supplier-portal/manufacturing/invoices')}
              className="text-xs" style={{ color: S.accent }}>View all →</button>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: S.muted }}>No outstanding invoices</p>
          ) : (
            recentInvoices.map((inv, idx) => {
              const overdueDays = inv.due_date ? Math.floor((now - new Date(inv.due_date).getTime()) / 86400000) : null
              const balance = inv.total - inv.amount_paid
              return (
                <div key={inv.id} onClick={() => router.push('/supplier-portal/manufacturing/invoices')}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                  style={{ borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = S.card)}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: overdueDays !== null && overdueDays > 0 ? ageColor(overdueDays) : '#16A34A' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: S.text }}>
                      {inv.job?.client?.client_name ?? '—'}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: S.muted }}>
                      {inv.invoice_number} · {inv.job?.job_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold" style={{ color: S.text }}>{fmtR(balance)}</p>
                    <p className="text-[10px]" style={{ color: overdueDays !== null && overdueDays > 0 ? '#DC2626' : S.muted }}>
                      {overdueDays !== null && overdueDays > 0 ? `${overdueDays}d overdue` : inv.due_date ? `due ${new Date(inv.due_date).toLocaleDateString('en-ZA')}` : '—'}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Revenue chart */}
      {monthlyRevenue.length > 0 && maxBar > 0 && (
        <div className="rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <h3 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: S.muted }}>Monthly Revenue — Last 6 Months</h3>
          <div className="flex items-end gap-3 h-28">
            {monthlyRevenue.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: 80 }}>
                  <div className="flex-1 rounded-t transition-all"
                    style={{ height: `${(m.invoiced / maxBar) * 100}%`, background: S.accent, opacity: 0.9, minHeight: m.invoiced > 0 ? 3 : 0 }} />
                  <div className="flex-1 rounded-t transition-all"
                    style={{ height: `${(m.received / maxBar) * 100}%`, background: '#16A34A', opacity: 0.7, minHeight: m.received > 0 ? 3 : 0 }} />
                </div>
                <span className="text-[9px]" style={{ color: S.muted }}>
                  {new Date(m.month + '-01').toLocaleDateString('en-ZA', { month: 'short' })}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: S.accent }} /><span className="text-xs" style={{ color: S.muted }}>Invoiced</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#16A34A', opacity: 0.7 }} /><span className="text-xs" style={{ color: S.muted }}>Received</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
