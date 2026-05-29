'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Clock, TrendingUp, Package, Building2, CheckCircle2,
  Info, Briefcase, FileText, DollarSign, Wrench, AlertCircle,
} from 'lucide-react'

// ── Exported so page.tsx can reference it for type import ─────────────────────
export interface QuotingDashboard {
  financial: {
    pipelineValue: number
    activeValue: number
    outstanding: number
    paidYTD: number
  }
  pipeline: QuoteRow[]
  active: QuoteRow[]
  completedQuotes: QuoteRow[]
  jobCards: {
    pending: JobCardRow[]
    in_progress: JobCardRow[]
    completed: JobCardRow[]
  }
}

interface QuoteRow {
  id: string
  quote_number: string
  project_name: string
  status: string
  expected_completion_date: string | null
  client_name: string | null
  contract_value: number
  approved_vo_value: number
}

interface JobCardRow {
  id: string
  job_number: string
  title: string
  status: string
  job_type: string
  client_name: string | null
  scheduled_at: string | null
  completed_at: string | null
  materials_value: number
}

interface AttentionRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  requestRef: string | null
  pendingCount: number
}

interface RecentRow {
  id: string
  token: string
  studioName: string
  sessionTitle: string
  requestRef: string | null
  status: string
  sentAt: string | null
}

interface Props {
  companyName: string
  hasQuoting: boolean
  stats: {
    activeRequests: number
    itemsToPrice: number
    studiosConnected: number
    acceptedQuotes: number
  }
  needsAttention: AttentionRow[]
  recentRequests: RecentRow[]
  quotingDashboard: QuotingDashboard | null
}

// ── Palette ───────────────────────────────────────────────────────────────────
const S = {
  accent: '#3A7CA5', gold: '#D9A441', text: '#111827', muted: '#6B7280',
  border: '#E5E7EB', card: '#FFFFFF', bg: '#F9FAFB', green: '#16A34A',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtR(n: number) {
  return 'R ' + Math.round(n).toLocaleString('en-ZA')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const QUOTE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:       { label: 'Draft',       bg: '#F4F4F5', color: '#71717A' },
  quoted:      { label: 'Quoted',      bg: '#EFF6FF', color: '#1D4ED8' },
  approved:    { label: 'Approved',    bg: '#FEF9EC', color: '#92600A' },
  in_progress: { label: 'In Progress', bg: '#ECFDF5', color: '#15803D' },
  completed:   { label: 'Completed',   bg: '#F0FDF4', color: '#166534' },
  cancelled:   { label: 'Cancelled',   bg: '#FEF2F2', color: '#DC2626' },
}

const JC_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(217,164,65,0.1)',  color: '#D9A441' },
  in_progress: { label: 'In Progress', bg: 'rgba(58,124,165,0.1)',  color: '#3A7CA5' },
  completed:   { label: 'Completed',   bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
}

const JC_TYPE: Record<string, string> = {
  maintenance: 'Maintenance', repair: 'Repair', once_off: 'Once-Off', callout: 'Callout',
}

const PR_STATUS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:     { label: 'Awaiting response', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
  viewed:      { label: 'Viewed',            bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  in_progress: { label: 'In progress',       bg: '#FEF9EC', color: '#92600A', border: '#F6D07A' },
  responded:   { label: 'Responded',         bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  completed:   { label: 'Completed',         bg: '#E6F4EA', color: '#2F7A4F', border: '#A7D7B5' },
  declined:    { label: 'Declined',          bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0' },
}

// ── Financial Strip ───────────────────────────────────────────────────────────
function FinancialStrip({ financial }: { financial: QuotingDashboard['financial'] }) {
  const cards = [
    {
      label: 'Pipeline',
      value: fmtR(financial.pipelineValue),
      sub: 'Quotes not yet started',
      icon: TrendingUp,
      color: S.accent,
      iconBg: 'rgba(58,124,165,0.08)',
    },
    {
      label: 'Active Jobs',
      value: fmtR(financial.activeValue),
      sub: 'Contract value in progress',
      icon: Briefcase,
      color: S.green,
      iconBg: 'rgba(22,163,74,0.08)',
    },
    {
      label: 'Outstanding',
      value: fmtR(financial.outstanding),
      sub: 'Invoiced, awaiting payment',
      icon: AlertCircle,
      color: financial.outstanding > 0 ? S.gold : S.muted,
      iconBg: financial.outstanding > 0 ? 'rgba(217,164,65,0.08)' : 'rgba(107,114,128,0.06)',
    },
    {
      label: 'Paid YTD',
      value: fmtR(financial.paidYTD),
      sub: `${new Date().getFullYear()} total received`,
      icon: DollarSign,
      color: S.green,
      iconBg: 'rgba(22,163,74,0.08)',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, color, iconBg }) => (
        <div
          key={label}
          className="rounded-xl px-4 py-4"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
              <Icon size={15} style={{ color }} />
            </div>
          </div>
          <p className="text-xl font-bold font-mono leading-none mb-1" style={{ color }}>{value}</p>
          <p className="text-[11px] font-semibold mb-0.5" style={{ color: S.text }}>{label}</p>
          <p className="text-[10px]" style={{ color: S.muted }}>{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Quotes Tab ────────────────────────────────────────────────────────────────
function QuotesTab({ pipeline, active, completedQuotes }: Pick<QuotingDashboard, 'pipeline' | 'active' | 'completedQuotes'>) {
  const isEmpty = pipeline.length === 0 && active.length === 0 && completedQuotes.length === 0

  if (isEmpty) {
    return (
      <div className="rounded-xl py-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
          <FileText size={18} style={{ color: '#94A3B8' }} />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No quotes yet</p>
        <p className="text-xs mb-4" style={{ color: S.muted }}>Create your first quote to track projects here</p>
        <Link
          href="/supplier-portal/quoting/quotes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          Go to Quotes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Active jobs */}
      {active.length > 0 && (
        <Section title="Active Jobs" sub={`${active.length} in progress`} accentColor={S.green}>
          {active.map((q, i) => (
            <QuoteListRow key={q.id} q={q} i={i} total={active.length} />
          ))}
        </Section>
      )}

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <Section title="Pipeline" sub={`${pipeline.length} quote${pipeline.length !== 1 ? 's' : ''} pending`} accentColor={S.accent}>
          {pipeline.map((q, i) => (
            <QuoteListRow key={q.id} q={q} i={i} total={pipeline.length} />
          ))}
        </Section>
      )}

      {/* Recent completed */}
      {completedQuotes.length > 0 && (
        <Section title="Recently Completed" sub={`${completedQuotes.length} project${completedQuotes.length !== 1 ? 's' : ''}`} accentColor="#166534">
          {completedQuotes.map((q, i) => (
            <QuoteListRow key={q.id} q={q} i={i} total={completedQuotes.length} />
          ))}
        </Section>
      )}

      <div className="text-right">
        <Link
          href="/supplier-portal/quoting/quotes"
          className="text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: S.accent }}
        >
          View all quotes →
        </Link>
      </div>
    </div>
  )
}

function QuoteListRow({ q, i, total }: { q: QuoteRow; i: number; total: number }) {
  const cfg = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft
  return (
    <Link
      href={`/supplier-portal/quoting/quotes/${q.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
      style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {q.client_name && <p className="text-xs" style={{ color: S.muted }}>{q.client_name}</p>}
          {q.expected_completion_date && (
            <p className="text-[10px]" style={{ color: S.muted }}>
              Due {fmtDate(q.expected_completion_date)}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold font-mono" style={{ color: S.text }}>
          {fmtR(q.contract_value + q.approved_vo_value)}
        </p>
        <p className="text-[10px]" style={{ color: S.muted }}>{q.quote_number}</p>
      </div>
      <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
    </Link>
  )
}

// ── Job Cards Tab ─────────────────────────────────────────────────────────────
function JobCardsTab({ jobCards }: { jobCards: QuotingDashboard['jobCards'] }) {
  const { pending, in_progress, completed } = jobCards
  const isEmpty = pending.length === 0 && in_progress.length === 0 && completed.length === 0

  if (isEmpty) {
    return (
      <div className="rounded-xl py-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
          <Wrench size={18} style={{ color: '#94A3B8' }} />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No job cards yet</p>
        <p className="text-xs mb-4" style={{ color: S.muted }}>Log maintenance, repairs, and callouts here</p>
        <Link
          href="/supplier-portal/quoting/job-cards"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          Go to Job Cards
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {in_progress.length > 0 && (
        <Section title="In Progress" sub={`${in_progress.length} active`} accentColor={S.accent}>
          {in_progress.map((jc, i) => (
            <JobCardRow key={jc.id} jc={jc} i={i} />
          ))}
        </Section>
      )}

      {pending.length > 0 && (
        <Section title="Pending" sub={`${pending.length} awaiting action`} accentColor={S.gold}>
          {pending.map((jc, i) => (
            <JobCardRow key={jc.id} jc={jc} i={i} />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Recently Completed" sub={`${completed.length} job${completed.length !== 1 ? 's' : ''}`} accentColor={S.green}>
          {completed.map((jc, i) => (
            <JobCardRow key={jc.id} jc={jc} i={i} />
          ))}
        </Section>
      )}

      <div className="text-right">
        <Link
          href="/supplier-portal/quoting/job-cards"
          className="text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: S.accent }}
        >
          View all job cards →
        </Link>
      </div>
    </div>
  )
}

function JobCardRow({ jc, i }: { jc: JobCardRow; i: number }) {
  const cfg = JC_STATUS[jc.status] ?? JC_STATUS.pending
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
          <p className="text-[10px]" style={{ color: S.muted }}>{JC_TYPE[jc.job_type] ?? jc.job_type}</p>
          {jc.scheduled_at && (
            <p className="text-[10px]" style={{ color: S.muted }}>Scheduled {fmtDate(jc.scheduled_at)}</p>
          )}
          {jc.completed_at && (
            <p className="text-[10px]" style={{ color: S.muted }}>Completed {fmtDate(jc.completed_at)}</p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {jc.materials_value > 0 && (
          <>
            <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(jc.materials_value)}</p>
            <p className="text-[10px]" style={{ color: S.muted }}>materials</p>
          </>
        )}
        <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>{jc.job_number}</p>
      </div>
      <ArrowRight size={13} style={{ color: '#CBD5E1' }} />
    </Link>
  )
}

// ── Shared section wrapper ────────────────────────────────────────────────────
function Section({ title, sub, accentColor, children }: {
  title: string; sub: string; accentColor: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(0,0,0,0.015)' }}
      >
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

// ── Main component ────────────────────────────────────────────────────────────
export function HomeClient({ companyName, hasQuoting, stats, needsAttention, recentRequests, quotingDashboard }: Props) {
  const [activeTab, setActiveTab] = useState<'quotes' | 'job_cards'>('quotes')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const hasPriceRequests = recentRequests.length > 0 || needsAttention.length > 0

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>{dateStr}</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>
          {greeting}, <span style={{ color: '#1E2A38' }}>{companyName}</span>
        </h1>
      </div>

      {/* Platform notice — non-quoting accounts only */}
      {!hasQuoting && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(58,124,165,0.06)', border: '1px solid rgba(58,124,165,0.15)' }}>
          <Info size={14} style={{ color: '#3A7CA5', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: '#4B6B8A' }}>
            <span className="font-semibold" style={{ color: '#1E2A38' }}>Price Requests is designed for manufacturers & product suppliers.</span>
            {' '}A <span className="font-semibold">1% platform fee</span> applies to the value of all accepted price requests. This fee is invoiced monthly.
          </p>
        </div>
      )}

      {/* ── Quoting Dashboard (electricians with quoting plan) ─────────────── */}
      {hasQuoting && quotingDashboard && (
        <div className="space-y-5">

          {/* Financial strip */}
          <FinancialStrip financial={quotingDashboard.financial} />

          {/* Tabs */}
          <div>
            <div className="flex items-center gap-1 mb-5" style={{ borderBottom: `1px solid ${S.border}` }}>
              {([
                { id: 'quotes'    as const, label: 'Quotes',    Icon: FileText  },
                { id: 'job_cards' as const, label: 'Job Cards', Icon: Wrench    },
              ]).map(({ id, label, Icon }) => {
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
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                        style={{ background: S.accent }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {activeTab === 'quotes' && (
              <QuotesTab
                pipeline={quotingDashboard.pipeline}
                active={quotingDashboard.active}
                completedQuotes={quotingDashboard.completedQuotes}
              />
            )}
            {activeTab === 'job_cards' && (
              <JobCardsTab jobCards={quotingDashboard.jobCards} />
            )}
          </div>
        </div>
      )}

      {/* ── Price Requests section ─────────────────────────────────────────── */}
      {(!hasQuoting || hasPriceRequests) && (
        <div className="space-y-6">

          {/* Only show header divider if quoting section is also visible */}
          {hasQuoting && hasPriceRequests && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: S.border }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>Price Requests</p>
              <div className="flex-1 h-px" style={{ background: S.border }} />
            </div>
          )}

          {/* Stat cards — non-quoting users */}
          {!hasQuoting && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Active Requests',  value: stats.activeRequests,   icon: TrendingUp,   alert: false },
                { label: 'Items to Price',   value: stats.itemsToPrice,     icon: Package,      alert: stats.itemsToPrice > 0 },
                { label: 'Studios',          value: stats.studiosConnected, icon: Building2,    alert: false },
                { label: 'Accepted Quotes',  value: stats.acceptedQuotes,   icon: CheckCircle2, alert: false },
              ].map(({ label, value, icon: Icon, alert }) => (
                <div
                  key={label}
                  className="rounded-xl px-5 py-4"
                  style={{
                    background: S.card,
                    border: `1px solid ${alert ? '#F6D07A' : S.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-2xl font-bold" style={{ color: alert ? '#92600A' : S.text }}>{value}</p>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: alert ? '#FEF9EC' : '#F1F5F9' }}>
                      <Icon size={15} style={{ color: alert ? '#D9A441' : S.accent }} />
                    </div>
                  </div>
                  <p className="text-xs font-medium" style={{ color: S.muted }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Needs attention */}
          {needsAttention.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#D9A441' }} />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                  Needs Attention
                </p>
              </div>
              <div className="space-y-2">
                {needsAttention.map(r => (
                  <div
                    key={r.id}
                    className="rounded-xl px-5 py-4 flex items-center gap-4"
                    style={{ background: '#FFFDF5', border: '1px solid #F6D07A', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#D9A441' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                        {r.requestRef ? <span className="font-mono mr-1">{r.requestRef} ·</span> : null}{r.studioName}
                      </p>
                      <p className="font-semibold text-sm truncate" style={{ color: S.text }}>{r.sessionTitle}</p>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0"
                      style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}
                    >
                      {r.pendingCount} to price
                    </span>
                    <Link
                      href={`/sourcing/respond/${r.token}`}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: S.accent, color: '#FFFFFF' }}
                    >
                      Price items <ArrowRight size={11} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent requests */}
          {recentRequests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: S.accent }} />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>
                    Recent Requests
                  </p>
                </div>
                <Link
                  href="/supplier-portal/dashboard"
                  className="text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: S.accent }}
                >
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {recentRequests.map(r => {
                  const cfg = PR_STATUS[r.status] ?? PR_STATUS.pending
                  return (
                    <Link
                      key={r.id}
                      href={`/sourcing/respond/${r.token}`}
                      className="rounded-xl px-5 py-3.5 flex items-center gap-4 block transition-colors"
                      style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.boxShadow = '0 2px 8px rgba(58,124,165,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium mb-0.5" style={{ color: '#94A3B8' }}>
                          {r.requestRef ? <span className="font-mono mr-1">{r.requestRef} ·</span> : null}{r.studioName}
                        </p>
                        <p className="font-semibold text-sm truncate" style={{ color: S.text }}>{r.sessionTitle}</p>
                        {r.sentAt && (
                          <p className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                            Received {fmtDate(r.sentAt)}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-md shrink-0"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.label}
                      </span>
                      <ArrowRight size={14} style={{ color: '#CBD5E1' }} />
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state — only if no quoting content and no price requests */}
          {!hasQuoting && recentRequests.length === 0 && needsAttention.length === 0 && (
            <div className="rounded-xl p-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                <Clock size={20} style={{ color: '#94A3B8' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>All caught up</p>
              <p className="text-sm" style={{ color: S.muted }}>
                No price requests yet. They&apos;ll appear here once design studios send them your way.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
