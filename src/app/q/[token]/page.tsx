'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Check, ChevronDown, ChevronRight, Loader2, AlertCircle, ThumbsUp, MessageSquare } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmt(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface QuoteData {
  quote: {
    id: string
    quote_number: string
    project_name: string
    project_address: string | null
    project_type: string | null
    contract_type: string
    status: string
    vat_rate: number
    retention_percentage: number
    payment_terms_days: number
    notes: string | null
    quoted_date: string | null
    expected_completion_date: string | null
    approved_date: string | null
  }
  client: { id: string; client_name: string; company: string | null; email: string | null; contact_number: string | null; address: string | null } | null
  sections: { id: string; title: string; sort_order: number }[]
  items: { id: string; section_id: string | null; description: string; unit: string | null; quoted_quantity: number; quoted_unit_rate: number; sort_order: number }[]
  company: { company_name: string | null; email: string | null; logo_url: string | null; phone: string | null } | null
}

export default function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [action, setAction] = useState<'approve' | 'request_changes' | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'requested' | null>(null)

  useEffect(() => {
    fetch(`/api/q/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        // Pre-set done state if already approved
        if (d.quote.status === 'approved') setDone('approved')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load quote'); setLoading(false) })
  }, [token])

  async function submit() {
    if (!action || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/q/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    const json = await res.json()
    if (json.ok) {
      setDone(action === 'approve' ? 'approved' : 'requested')
    } else {
      alert(json.error ?? 'Something went wrong')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
        <Loader2 size={28} className="animate-spin" style={{ color: S.accent }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: S.bg }}>
        <AlertCircle size={32} style={{ color: S.danger }} />
        <p className="text-sm font-medium" style={{ color: S.text }}>Quote not found or link has expired.</p>
      </div>
    )
  }

  const { quote, client, sections, items, company } = data

  const subtotal = items.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
  const vatAmt = subtotal * (quote.vat_rate / 100)
  const total = subtotal + vatAmt
  const retention = subtotal * (quote.retention_percentage / 100)

  const itemsBySection: Record<string, typeof items> = {}
  for (const item of items) {
    const key = item.section_id ?? '__free__'
    if (!itemsBySection[key]) itemsBySection[key] = []
    itemsBySection[key].push(item)
  }

  const isAlreadyActioned = done !== null || quote.status === 'approved' || quote.status === 'cancelled'

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: S.bg }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="rounded-2xl p-6 mb-4 flex items-start justify-between gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex-1 min-w-0">
            {company?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="h-10 mb-3 object-contain" />
            )}
            {!company?.logo_url && company?.company_name && (
              <p className="font-bold text-lg mb-3" style={{ color: S.text }}>{company.company_name}</p>
            )}
            <h1 className="text-2xl font-bold mb-1" style={{ color: S.text }}>{quote.project_name}</h1>
            {quote.project_address && <p className="text-sm" style={{ color: S.muted }}>{quote.project_address}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-mono text-sm font-semibold" style={{ color: S.accent }}>{quote.quote_number}</p>
            {quote.quoted_date && <p className="text-xs mt-1" style={{ color: S.muted }}>{fmt(quote.quoted_date)}</p>}
            {quote.status === 'approved' && (
              <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: S.green }}>
                Approved {quote.approved_date ? `· ${fmt(quote.approved_date)}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Project details */}
        <div className="rounded-2xl p-5 mb-4 grid grid-cols-2 gap-x-8 gap-y-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {client && (
            <div className="col-span-2 pb-3 mb-1" style={{ borderBottom: `1px solid ${S.border}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Prepared for</p>
              <p className="text-sm font-semibold" style={{ color: S.text }}>{client.client_name}</p>
              {client.company && <p className="text-xs" style={{ color: S.muted }}>{client.company}</p>}
            </div>
          )}
          {[
            { label: 'Project Type', value: quote.project_type ? quote.project_type.charAt(0).toUpperCase() + quote.project_type.slice(1) : null },
            { label: 'Contract Type', value: quote.contract_type === 'lump_sum' ? 'Lump Sum' : quote.contract_type === 're_measurement' ? 'Re-measurement' : 'Cost Plus' },
            { label: 'Expected Completion', value: fmt(quote.expected_completion_date) },
            { label: 'Payment Terms', value: quote.payment_terms_days ? `${quote.payment_terms_days} days` : null },
            { label: 'Retention', value: quote.retention_percentage > 0 ? `${quote.retention_percentage}%` : null },
          ].filter(f => f.value).map(f => (
            <div key={f.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>{f.label}</p>
              <p className="text-sm" style={{ color: S.text }}>{f.value}</p>
            </div>
          ))}
          {company && (
            <div className="col-span-2 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Submitted by</p>
              <p className="text-sm font-medium" style={{ color: S.text }}>{company.company_name}</p>
              {[company.email, company.phone].filter(Boolean).map(v => (
                <p key={v} className="text-xs" style={{ color: S.muted }}>{v}</p>
              ))}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="mb-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: S.muted }}>Quote Breakdown</h2>

          {/* Free items (no section) */}
          {itemsBySection['__free__'] && itemsBySection['__free__'].length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <LineItemsTable items={itemsBySection['__free__']} />
            </div>
          )}

          {/* Sections */}
          {sections.map(sec => {
            const secItems = itemsBySection[sec.id] ?? []
            const secTotal = secItems.reduce((s, i) => s + i.quoted_quantity * i.quoted_unit_rate, 0)
            const isCollapsed = collapsed[sec.id] ?? false
            return (
              <div key={sec.id} className="rounded-2xl overflow-hidden mb-2" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [sec.id]: !c[sec.id] }))}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  style={{ background: 'rgba(58,124,165,0.04)', borderBottom: isCollapsed ? 'none' : `1px solid ${S.border}` }}>
                  {isCollapsed ? <ChevronRight size={14} style={{ color: S.muted }} /> : <ChevronDown size={14} style={{ color: S.muted }} />}
                  <span className="flex-1 text-sm font-semibold" style={{ color: S.text }}>{sec.title}</span>
                  <span className="text-sm font-semibold" style={{ color: S.accent }}>{fmtR(secTotal)}</span>
                </button>
                {!isCollapsed && <LineItemsTable items={secItems} />}
              </div>
            )
          })}
        </div>

        {/* Totals */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Subtotal (ex VAT)</span>
              <span className="font-medium" style={{ color: S.text }}>{fmtR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>VAT ({quote.vat_rate}%)</span>
              <span className="font-medium" style={{ color: S.text }}>{fmtR(vatAmt)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
              <span style={{ color: S.text }}>Total incl. VAT</span>
              <span style={{ color: S.accent }}>{fmtR(total)}</span>
            </div>
            {retention > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span style={{ color: S.muted }}>Retention ({quote.retention_percentage}%)</span>
                <span className="font-medium" style={{ color: S.gold }}>{fmtR(retention)}</span>
              </div>
            )}
          </div>
        </div>

        {quote.notes && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>Notes</p>
            <p className="text-sm" style={{ color: S.text, lineHeight: 1.7 }}>{quote.notes}</p>
          </div>
        )}

        {/* Action panel */}
        {done === 'approved' ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(22,163,74,0.06)', border: `1.5px solid ${S.green}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <Check size={24} style={{ color: S.green }} />
            </div>
            <p className="font-bold text-lg mb-1" style={{ color: S.green }}>Quote Approved</p>
            <p className="text-sm" style={{ color: S.muted }}>
              {quote.approved_date ? `Approved on ${fmt(quote.approved_date)}. ` : ''}
              {company?.company_name ?? 'The contractor'} has been notified.
            </p>
          </div>
        ) : done === 'requested' ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(58,124,165,0.1)' }}>
              <MessageSquare size={24} style={{ color: S.accent }} />
            </div>
            <p className="font-bold text-lg mb-1" style={{ color: S.text }}>Changes Requested</p>
            <p className="text-sm" style={{ color: S.muted }}>Your feedback has been sent. {company?.company_name ?? 'The contractor'} will be in touch.</p>
          </div>
        ) : isAlreadyActioned ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-sm" style={{ color: S.muted }}>This quote is no longer pending approval.</p>
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <h3 className="font-bold text-base mb-1" style={{ color: S.text }}>Your Response</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>Review the quote above and let us know how you'd like to proceed.</p>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAction('approve')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: action === 'approve' ? S.green : 'rgba(22,163,74,0.08)',
                  color: action === 'approve' ? '#fff' : S.green,
                  border: `1.5px solid ${action === 'approve' ? S.green : 'rgba(22,163,74,0.3)'}`,
                }}>
                <ThumbsUp size={16} /> Approve Quote
              </button>
              <button
                onClick={() => setAction('request_changes')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: action === 'request_changes' ? S.accent : 'rgba(58,124,165,0.08)',
                  color: action === 'request_changes' ? '#fff' : S.accent,
                  border: `1.5px solid ${action === 'request_changes' ? S.accent : 'rgba(58,124,165,0.3)'}`,
                }}>
                <MessageSquare size={16} /> Request Changes
              </button>
            </div>

            {action === 'request_changes' && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe what you'd like changed…"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none mb-4"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
              />
            )}

            {action && (
              <button
                onClick={() => void submit()}
                disabled={submitting || (action === 'request_changes' && !notes.trim())}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: action === 'approve' ? S.green : S.accent, color: '#fff' }}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {action === 'approve' ? 'Confirm Approval' : 'Send Feedback'}
              </button>
            )}
          </div>
        )}

        <p className="text-center text-xs mt-8" style={{ color: S.muted }}>
          Powered by <span className="font-semibold">QuotingHub</span>
        </p>
      </div>
    </div>
  )
}

function LineItemsTable({ items }: { items: { description: string; unit: string | null; quoted_quantity: number; quoted_unit_rate: number }[] }) {
  return (
    <div className="divide-y" style={{ borderColor: S.border }}>
      <div className="grid px-4 py-2" style={{ gridTemplateColumns: '1fr 56px 88px 88px 96px' }}>
        {['Description', 'Unit', 'Qty', 'Rate', 'Total'].map(h => (
          <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-right first:text-left" style={{ color: S.muted }}>{h}</span>
        ))}
      </div>
      {items.map((item, i) => {
        const lineTotal = item.quoted_quantity * item.quoted_unit_rate
        return (
          <div key={i} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: '1fr 56px 88px 88px 96px', background: i % 2 === 0 ? 'transparent' : S.bg }}>
            <span className="text-sm pr-4" style={{ color: S.text }}>{item.description}</span>
            <span className="text-xs text-right" style={{ color: S.muted }}>{item.unit ?? '—'}</span>
            <span className="text-sm text-right" style={{ color: S.text }}>{item.quoted_quantity}</span>
            <span className="text-sm text-right" style={{ color: S.text }}>{fmtR(item.quoted_unit_rate)}</span>
            <span className="text-sm text-right font-medium" style={{ color: S.text }}>{fmtR(lineTotal)}</span>
          </div>
        )
      })}
    </div>
  )
}
