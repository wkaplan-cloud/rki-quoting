'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, FileText, Wrench, TrendingUp, Briefcase,
  CheckCircle2, AlertCircle, DollarSign,
} from 'lucide-react'
import type { ElecQuoteStatus } from '@/lib/elec-types'

// ── Types ────────────────────────────────────────────────────────────────────

type QuoteRow = {
  id: string
  quote_number: string
  project_name: string
  status: ElecQuoteStatus
  expected_completion_date: string | null
  client_name: string | null
  contract_value: number
  approved_vo_value: number
  claimed: number
  invoiced: number
  paid: number
}

type ReconEntry = {
  claimed: number
  certified: number
  invoiced: number
  paid: number
}

type JobCardRow = {
  id: string
  job_number: string
  title: string
  status: string
  job_type: string
  client_name: string | null
  scheduled_at: string | null
  completed_at: string | null
  materials_value: number
  total_charge: number
}

interface Props {
  financial: {
    pipelineValue: number
    activeValue: number
    completedValue: number
    outstanding: number
    paidYTD: number
  }
  pipeline: QuoteRow[]
  active: QuoteRow[]
  completed: QuoteRow[]
  reconMonths: string[]
  reconMap: Record<string, ReconEntry>
  jobCards: {
    pending: JobCardRow[]
    in_progress: JobCardRow[]
    completed: JobCardRow[]
  }
  jobCardSummary: {
    pendingCount: number
    inProgressCount: number
    completedCount: number
    totalRevenue: number
  }
}

// ── Palette ──────────────────────────────────────────────────────────────────

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtR(n: number) {
  return 'R ' + Math.round(n).toLocaleString('en-ZA')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMonth(yyyyMM01: string) {
  return new Date(yyyyMM01 + 'T12:00:00').toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
}

const QUOTE_STATUS_CFG: Partial<Record<ElecQuoteStatus, { label: string; bg: string; color: string }>> = {
  draft:       { label: 'Draft',       bg: '#F4F4F5', color: '#71717A' },
  quoted:      { label: 'Quoted',      bg: '#EFF6FF', color: '#1D4ED8' },
  approved:    { label: 'Approved',    bg: '#FEF9EC', color: '#92600A' },
  in_progress: { label: 'In Progress', bg: '#ECFDF5', color: '#15803D' },
  completed:   { label: 'Completed',   bg: '#F0FDF4', color: '#166534' },
  cancelled:   { label: 'Cancelled',   bg: '#FEF2F2', color: S.danger  },
}

const JC_STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(217,164,65,0.12)',  color: S.gold   },
  in_progress: { label: 'In Progress', bg: 'rgba(58,124,165,0.12)',  color: S.accent },
  completed:   { label: 'Completed',   bg: 'rgba(22,163,74,0.12)',   color: S.green  },
}

const JC_TYPE_LABEL: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout', coc: 'C.O.C',
}

// ── Financial Strip ───────────────────────────────────────────────────────────

function FinancialStrip({ financial }: { financial: Props['financial'] }) {
  const { pipelineValue, activeValue, completedValue, outstanding, paidYTD } = financial
  const cards = [
    { label: 'Pipeline',    value: fmtR(pipelineValue),  sub: 'Projects pending',          icon: TrendingUp,   color: S.accent,                                          iconBg: 'rgba(58,124,165,0.08)'  },
    { label: 'Active Jobs', value: fmtR(activeValue),    sub: 'Contract value',           icon: Briefcase,    color: S.green,                                           iconBg: 'rgba(22,163,74,0.08)'   },
    { label: 'Completed',   value: fmtR(completedValue), sub: 'Total contract value',     icon: CheckCircle2, color: '#166534',                                         iconBg: 'rgba(22,101,52,0.08)'   },
    { label: 'Outstanding', value: fmtR(outstanding),    sub: 'Invoiced, not yet paid',   icon: AlertCircle,  color: outstanding > 0 ? S.gold : S.muted,                iconBg: outstanding > 0 ? 'rgba(217,164,65,0.08)' : 'rgba(113,113,122,0.06)' },
    { label: 'Paid YTD',   value: fmtR(paidYTD),        sub: `${new Date().getFullYear()} received`,        icon: DollarSign,   color: S.green,                       iconBg: 'rgba(22,163,74,0.08)'   },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cards.map(({ label, value, sub, icon: Icon, color, iconBg }) => (
        <div key={label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3" style={{ background: iconBg }}>
            <Icon size={14} style={{ color }} />
          </div>
          <p className="text-lg font-bold font-mono leading-none mb-1" style={{ color }}>{value}</p>
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
          <p className="text-[10px]" style={{ color: S.muted }}>{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Job Card Strip ────────────────────────────────────────────────────────────

function JobCardStrip({ summary }: { summary: Props['jobCardSummary'] }) {
  const { pendingCount, inProgressCount, completedCount, totalRevenue } = summary
  const cards = [
    { label: 'Pending',     value: pendingCount,    sub: 'Awaiting action',    color: S.gold,   iconBg: 'rgba(217,164,65,0.08)',  fmt: 'count' },
    { label: 'Active',      value: inProgressCount, sub: 'Currently on site',  color: S.accent, iconBg: 'rgba(58,124,165,0.08)',  fmt: 'count' },
    { label: 'Completed',   value: completedCount,  sub: 'Total job cards',    color: S.green,  iconBg: 'rgba(22,163,74,0.08)',   fmt: 'count' },
    { label: 'Total Revenue', value: totalRevenue,  sub: 'From completed jobs', color: S.green, iconBg: 'rgba(22,163,74,0.08)',   fmt: 'money' },
  ] as const

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Job Cards</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ label, value, sub, color, iconBg, fmt }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3" style={{ background: iconBg }}>
              <Wrench size={14} style={{ color }} />
            </div>
            <p className="text-lg font-bold font-mono leading-none mb-1" style={{ color }}>
              {fmt === 'money' ? fmtR(value as number) : value}
            </p>
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
            <p className="text-[10px]" style={{ color: S.muted }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Quotes Tab ────────────────────────────────────────────────────────────────

function QuotesTab({ pipeline, active, completed, reconMonths, reconMap }: {
  pipeline: QuoteRow[]
  active: QuoteRow[]
  completed: QuoteRow[]
  reconMonths: string[]
  reconMap: Record<string, ReconEntry>
}) {
  const isEmpty = pipeline.length === 0 && active.length === 0 && completed.length === 0

  if (isEmpty) {
    return (
      <div className="rounded-2xl py-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No quotes yet</p>
        <p className="text-xs mb-4" style={{ color: S.muted }}>Create your first quote to get started</p>
        <Link
          href="/supplier-portal/quoting/quotes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          Create Quote
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Active Jobs */}
      {active.length > 0 && (
        <SectionCard title="Active Jobs" sub={`${active.length} in progress`} accentColor={S.green}>
          {active.map((q, i) => {
            const adjusted = q.contract_value + q.approved_vo_value
            const balance = adjusted - q.claimed
            const pct = adjusted > 0 ? Math.min(100, Math.round((q.claimed / adjusted) * 100)) : 0
            return (
              <Link
                key={q.id}
                href={`/supplier-portal/quoting/quotes/${q.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#ECFDF5', color: '#15803D' }}>
                      {q.quote_number}
                    </span>
                  </div>
                  {q.client_name && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client_name}</p>}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: S.bg, width: 100 }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: S.accent }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] mb-0.5" style={{ color: S.muted }}>Contract</p>
                  <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(adjusted)}</p>
                  <p className="text-[10px] mt-0.5 font-semibold" style={{ color: balance > 0.01 ? S.gold : S.green }}>
                    {balance > 0.01 ? `To claim: ${fmtR(balance)}` : 'Fully claimed'}
                  </p>
                </div>
                <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
              </Link>
            )
          })}
        </SectionCard>
      )}

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <SectionCard title="Pipeline" sub="Not yet in progress" accentColor={S.accent}>
          {pipeline.map((q, i) => {
            const cfg = QUOTE_STATUS_CFG[q.status]
            return (
              <Link
                key={q.id}
                href={`/supplier-portal/quoting/quotes/${q.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                    {cfg && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                  {q.client_name && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client_name}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(q.contract_value)}</p>
                  {q.expected_completion_date && (
                    <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>
                      Due {fmtDate(q.expected_completion_date)}
                    </p>
                  )}
                </div>
                <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
              </Link>
            )
          })}
        </SectionCard>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <SectionCard title="Completed Jobs" sub={`${completed.length} project${completed.length !== 1 ? 's' : ''}`} accentColor="#166534">
          {completed.map((q, i) => {
            const adjusted = q.contract_value + q.approved_vo_value
            return (
              <Link
                key={q.id}
                href={`/supplier-portal/quoting/quotes/${q.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#F0FDF4', color: '#166534' }}>
                      {q.quote_number}
                    </span>
                  </div>
                  {q.client_name && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client_name}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(adjusted)}</p>
                  <p className="text-[10px] mt-0.5 font-semibold"
                    style={{ color: q.paid >= adjusted * 0.99 ? S.green : S.gold }}>
                    {q.paid >= adjusted * 0.99 ? 'Fully paid' : `Outstanding: ${fmtR(adjusted - q.paid)}`}
                  </p>
                </div>
                <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
              </Link>
            )
          })}
        </SectionCard>
      )}

      {/* Monthly RECON */}
      {reconMonths.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(58,124,165,0.04)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Monthly RECON</p>
            <p className="text-[10px]" style={{ color: S.muted }}>Cash flow by claim period · last 12 months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                  {['Month', 'Claimed', 'Certified', 'Invoiced', 'Paid', 'Outstanding'].map((h, hi) => (
                    <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: S.muted, textAlign: hi === 0 ? 'left' : 'right' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconMonths.map((month, i) => {
                  const r = reconMap[month]
                  const out = r.invoiced - r.paid
                  return (
                    <tr key={month} style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <td className="px-4 py-2.5 text-xs font-medium" style={{ color: S.text }}>{fmtMonth(month)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(r.claimed)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(r.certified)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.accent }}>{fmtR(r.invoiced)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.green }}>{fmtR(r.paid)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono font-semibold"
                        style={{ color: out > 0.01 ? S.gold : S.muted }}>
                        {fmtR(out)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-right">
        <Link href="/supplier-portal/quoting/quotes" className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: S.accent }}>
          Manage all quotes →
        </Link>
      </div>
    </div>
  )
}

// ── Job Cards Tab ─────────────────────────────────────────────────────────────

function JobCardsTab({ jobCards }: { jobCards: Props['jobCards'] }) {
  const { pending, in_progress, completed } = jobCards
  const isEmpty = pending.length === 0 && in_progress.length === 0 && completed.length === 0

  if (isEmpty) {
    return (
      <div className="rounded-2xl py-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No job cards yet</p>
        <p className="text-xs mb-4" style={{ color: S.muted }}>Log maintenance, repairs, and callouts here</p>
        <Link
          href="/supplier-portal/quoting/job-cards"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          Create Job Card
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {in_progress.length > 0 && (
        <SectionCard title="In Progress" sub={`${in_progress.length} active`} accentColor={S.accent}>
          {in_progress.map((jc, i) => <JobCardRow key={jc.id} jc={jc} i={i} />)}
        </SectionCard>
      )}

      {pending.length > 0 && (
        <SectionCard title="Pending" sub={`${pending.length} awaiting action`} accentColor={S.gold}>
          {pending.map((jc, i) => <JobCardRow key={jc.id} jc={jc} i={i} />)}
        </SectionCard>
      )}

      {completed.length > 0 && (
        <SectionCard title="Recently Completed" sub={`${completed.length} job${completed.length !== 1 ? 's' : ''}`} accentColor={S.green}>
          {completed.map((jc, i) => <JobCardRow key={jc.id} jc={jc} i={i} />)}
        </SectionCard>
      )}

      <div className="text-right">
        <Link href="/supplier-portal/quoting/job-cards" className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: S.accent }}>
          Manage all job cards →
        </Link>
      </div>
    </div>
  )
}

function JobCardRow({ jc, i }: { jc: JobCardRow; i: number }) {
  const cfg = JC_STATUS_CFG[jc.status] ?? JC_STATUS_CFG.pending
  return (
    <Link
      href={`/supplier-portal/quoting/job-cards/${jc.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{jc.title}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {jc.client_name && <p className="text-xs" style={{ color: S.muted }}>{jc.client_name}</p>}
          <p className="text-[10px]" style={{ color: S.muted }}>{JC_TYPE_LABEL[jc.job_type] ?? jc.job_type}</p>
          {jc.scheduled_at && <p className="text-[10px]" style={{ color: S.muted }}>Scheduled {fmtDate(jc.scheduled_at)}</p>}
          {jc.completed_at && <p className="text-[10px]" style={{ color: S.muted }}>Done {fmtDate(jc.completed_at)}</p>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {jc.total_charge > 0 && (
          <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(jc.total_charge)}</p>
        )}
        <p className="text-[10px]" style={{ color: S.muted }}>{jc.job_number}</p>
      </div>
      <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
    </Link>
  )
}

// ── Shared section card ───────────────────────────────────────────────────────

function SectionCard({ title, sub, accentColor, children }: {
  title: string; sub: string; accentColor: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(0,0,0,0.015)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <p className="text-sm font-semibold" style={{ color: S.text }}>{title}</p>
        </div>
        <p className="text-[10px]" style={{ color: S.muted }}>{sub}</p>
      </div>
      {children}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export function QuotingDashboardClient({ financial, pipeline, active, completed, reconMonths, reconMap, jobCards, jobCardSummary }: Props) {
  const [activeTab, setActiveTab] = useState<'quotes' | 'job_cards'>('quotes')

  const totalQuotes = pipeline.length + active.length + completed.length
  const totalJobCards = jobCards.pending.length + jobCards.in_progress.length + jobCards.completed.length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Quoting Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {active.length} active · {pipeline.length} in pipeline · {completed.length} completed
          </p>
        </div>
        <Link
          href="/supplier-portal/quoting/quotes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          All Projects
        </Link>
      </div>

      {/* Projects financial strip */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Projects</p>
        <FinancialStrip financial={financial} />
      </div>

      {/* Job cards strip */}
      <JobCardStrip summary={jobCardSummary} />

      {/* Tabs */}
      <div>
        <div className="flex items-center gap-1 mb-5" style={{ borderBottom: `1px solid ${S.border}` }}>
          {([
            { id: 'quotes'    as const, label: 'Projects',  Icon: FileText, count: totalQuotes    },
            { id: 'job_cards' as const, label: 'Job Cards', Icon: Wrench,   count: totalJobCards  },
          ]).map(({ id, label, Icon, count }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors relative"
                style={{ color: isActive ? S.accent : S.muted }}
              >
                <Icon size={13} />
                {label}
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: isActive ? 'rgba(58,124,165,0.12)' : '#F4F4F5', color: isActive ? S.accent : S.muted }}
                  >
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: S.accent }} />
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'quotes' && (
          <QuotesTab
            pipeline={pipeline}
            active={active}
            completed={completed}
            reconMonths={reconMonths}
            reconMap={reconMap}
          />
        )}
        {activeTab === 'job_cards' && (
          <JobCardsTab jobCards={jobCards} />
        )}
      </div>
    </div>
  )
}
