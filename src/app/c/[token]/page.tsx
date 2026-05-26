'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  green: '#16A34A', gold: '#D9A441',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr.length === 7 ? dateStr + '-01' : dateStr)
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',      color: '#71717A', bg: '#F4F4F5' },
  submitted: { label: 'Submitted',  color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)' },
  certified: { label: 'Certified',  color: '#D9A441', bg: 'rgba(217,164,65,0.1)' },
  invoiced:  { label: 'Tax Invoice',color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  paid:      { label: 'Paid',       color: '#166534', bg: 'rgba(22,101,52,0.1)' },
}

interface ClaimData {
  claim: {
    id: string; claim_number: string; claim_date: string; period_month: string
    claim_type: string; status: string; total_claimed: number; total_certified: number | null
    total_invoiced: number | null; sent_to_name: string | null; notes: string | null
    line_items: { id: string; quote_line_item_id: string; percentage_claimed: number; amount_claimed: number }[]
  }
  quote: { quote_number: string; project_name: string; project_address: string | null } | null
  client: { client_name: string; company: string | null } | null
  quoteItems: { id: string; description: string; section_id: string | null; quoted_quantity: number; quoted_unit_rate: number }[]
  company: { company_name: string | null; email: string | null; phone: string | null; logo_url: string | null } | null
}

export default function ClaimViewPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ClaimData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/c/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <Loader2 size={24} className="animate-spin" style={{ color: S.muted }} />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: S.bg }}>
      <div className="text-center">
        <AlertCircle size={32} style={{ color: S.muted }} className="mx-auto mb-3" />
        <p className="font-semibold" style={{ color: S.text }}>Claim not found</p>
        <p className="text-sm mt-1" style={{ color: S.muted }}>This link may have expired or is invalid.</p>
      </div>
    </div>
  )

  const { claim, quote, client, quoteItems, company } = data
  const companyName = company?.company_name ?? company?.email ?? 'Your contractor'
  const st = STATUS_LABELS[claim.status] ?? STATUS_LABELS.submitted
  const titleWord = claim.claim_type === 'retention' ? 'Retention Release' : ['invoiced', 'paid'].includes(claim.status) ? 'Tax Invoice' : 'Progress Claim'

  const quoteItemMap = Object.fromEntries(quoteItems.map(qi => [qi.id, qi]))

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: S.bg }}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-6 py-5" style={{ background: '#1E2A38' }}>
            <p className="text-xl font-bold text-white">{companyName}</p>
            <p className="text-[11px] mt-1 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>{titleWord}</p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Claim / Invoice Number</p>
                <p className="text-lg font-bold" style={{ color: S.accent }}>{claim.claim_number}</p>
              </div>
              <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Billing Period</p>
                <p className="text-sm font-semibold" style={{ color: S.text }}>{fmtMonth(claim.period_month)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Claim Date</p>
                <p className="text-sm font-semibold" style={{ color: S.text }}>{fmtDate(claim.claim_date)}</p>
              </div>
              {quote && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project</p>
                  <p className="text-sm font-semibold" style={{ color: S.text }}>{quote.project_name}</p>
                  {quote.project_address && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{quote.project_address}</p>}
                </div>
              )}
              {client && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Prepared for</p>
                  <p className="text-sm" style={{ color: S.text }}>{client.client_name}{client.company ? ` · ${client.company}` : ''}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        {claim.line_items.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: S.muted }}>Line Items</p>
            </div>
            <div className="grid px-5 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 70px 90px', gap: 8, color: S.muted }}>
              <span>Description</span>
              <span className="text-right">% Claimed</span>
              <span className="text-right">Amount</span>
            </div>
            {claim.line_items.map(li => {
              const qi = quoteItemMap[li.quote_line_item_id]
              return (
                <div key={li.id} className="grid px-5 py-3 items-center"
                  style={{ gridTemplateColumns: '1fr 70px 90px', gap: 8, borderTop: `1px solid ${S.border}` }}>
                  <span className="text-sm" style={{ color: S.text }}>{qi?.description ?? '—'}</span>
                  <span className="text-xs text-right" style={{ color: S.muted }}>{li.percentage_claimed.toFixed(0)}%</span>
                  <span className="text-sm text-right font-semibold font-mono" style={{ color: S.text }}>{fmtR(li.amount_claimed)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Totals */}
        <div className="rounded-2xl p-5" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Total Claimed</span>
              <span className="font-bold text-base" style={{ color: S.text }}>{fmtR(claim.total_claimed)}</span>
            </div>
            {claim.total_certified != null && (
              <div className="flex justify-between text-sm pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
                <span style={{ color: S.muted }}>Total Certified</span>
                <span className="font-semibold" style={{ color: S.gold }}>{fmtR(claim.total_certified)}</span>
              </div>
            )}
            {claim.total_invoiced != null && (
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Invoiced</span>
                <span className="font-semibold" style={{ color: S.green }}>{fmtR(claim.total_invoiced)}</span>
              </div>
            )}
          </div>
        </div>

        {claim.notes && (
          <div className="rounded-2xl px-5 py-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</p>
            <p className="text-sm" style={{ color: S.text }}>{claim.notes}</p>
          </div>
        )}

        <p className="text-center text-xs pb-4" style={{ color: S.muted }}>
          Sent via <a href="https://quotinghub.co.za" style={{ color: S.accent }}>QuotingHub</a>
        </p>
      </div>
    </div>
  )
}
