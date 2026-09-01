'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Check, X, Loader2, AlertCircle } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface VOData {
  vo: {
    id: string
    vo_number: string
    description: string
    value: number
    notes: string | null
    requested_by: string | null
    status: string
    rejection_notes: string | null
    approved_date: string | null
    vat_rate: number
  }
  items: {
    id: string
    description: string
    unit: string | null
    quantity: number
    unit_rate: number
    amount: number
  }[]
  project: {
    project_name: string
    quote_number: string
  }
  company: {
    company_name: string | null
    email: string | null
    logo_url: string | null
  }
}

export default function VOApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<VOData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  useEffect(() => {
    fetch(`/api/vo/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        document.title = `${d.vo.vo_number} – ${d.project.project_name} | QuotingHub`
        if (d.vo.status === 'approved') setDone('approved')
        if (d.vo.status === 'rejected') setDone('rejected')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [token])

  async function submit() {
    if (!action || submitting) return
    if (action === 'reject' && !notes.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/vo/${token}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes: notes.trim() || undefined }),
    })
    const json = await res.json()
    if (json.ok) {
      setDone(action === 'approve' ? 'approved' : 'rejected')
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
        <p className="text-sm font-medium" style={{ color: S.text }}>Variation order not found or link has expired.</p>
      </div>
    )
  }

  const { vo, project, company } = data
  const items = data.items ?? []
  const vatAmt = vo.value * (vo.vat_rate / 100)
  const totalIncVat = vo.value + vatAmt
  const isAlreadyActioned = done !== null || vo.status !== 'pending'

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: S.bg }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="rounded-2xl p-6 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {company.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="" className="h-10 mb-3 object-contain" />
          )}
          {!company.logo_url && company.company_name && (
            <p className="font-bold text-base mb-2" style={{ color: S.text }}>{company.company_name}</p>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Variation Order — Action Required</p>
          <h1 className="text-xl font-bold" style={{ color: S.text }}>{project.project_name}</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>{project.quote_number}</p>
        </div>

        {/* VO Details */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{vo.vo_number}</p>
          <p className="text-base font-semibold mb-4" style={{ color: S.text }}>{vo.description}</p>

          {vo.notes && (
            <p className="text-sm italic mb-4" style={{ color: S.muted }}>{vo.notes}</p>
          )}
          {vo.requested_by && (
            <p className="text-xs mb-4" style={{ color: S.muted }}>Requested by: {vo.requested_by}</p>
          )}

          {items.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${S.border}` }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: S.input }}>
                      <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Description</th>
                      <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: S.muted }}>Qty</th>
                      <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>Unit</th>
                      <th className="text-right px-2 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: S.muted }}>Rate</th>
                      <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: S.muted }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(li => (
                      <tr key={li.id} style={{ borderTop: `1px solid ${S.border}` }}>
                        <td className="px-3 py-2.5 text-xs" style={{ color: S.text }}>{li.description}</td>
                        <td className="px-2 py-2.5 text-xs text-right whitespace-nowrap" style={{ color: S.muted }}>{li.quantity.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}</td>
                        <td className="px-2 py-2.5 text-xs" style={{ color: S.muted }}>{li.unit ?? ''}</td>
                        <td className="px-2 py-2.5 text-xs text-right whitespace-nowrap" style={{ color: S.muted }}>{fmtR(li.unit_rate)}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-semibold whitespace-nowrap" style={{ color: S.text }}>{fmtR(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Value (ex VAT)</span>
              <span className="font-medium" style={{ color: S.text }}>{fmtR(vo.value)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>VAT ({vo.vat_rate}%)</span>
              <span className="font-medium" style={{ color: S.text }}>{fmtR(vatAmt)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
              <span style={{ color: S.text }}>Total incl. VAT</span>
              <span style={{ color: S.accent }}>{fmtR(totalIncVat)}</span>
            </div>
          </div>
        </div>

        {/* Action panel */}
        {done === 'approved' ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(22,163,74,0.06)', border: `1.5px solid ${S.green}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(22,163,74,0.12)' }}>
              <Check size={24} style={{ color: S.green }} />
            </div>
            <p className="font-bold text-lg mb-1" style={{ color: S.green }}>Variation Order Approved</p>
            <p className="text-sm" style={{ color: S.muted }}>
              {vo.approved_date ? `Approved on ${new Date(vo.approved_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}. ` : ''}
              {company.company_name ?? 'The contractor'} has been notified.
            </p>
          </div>
        ) : done === 'rejected' ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#FEF2F2', border: `1.5px solid #FECACA` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(220,38,38,0.1)' }}>
              <X size={24} style={{ color: S.danger }} />
            </div>
            <p className="font-bold text-lg mb-1" style={{ color: S.danger }}>Variation Order Rejected</p>
            <p className="text-sm" style={{ color: S.muted }}>
              {company.company_name ?? 'The contractor'} has been notified.
            </p>
            {vo.rejection_notes && (
              <p className="text-sm mt-2 italic" style={{ color: S.muted }}>&quot;{vo.rejection_notes}&quot;</p>
            )}
          </div>
        ) : isAlreadyActioned ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-sm" style={{ color: S.muted }}>This variation order is no longer pending approval.</p>
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <h3 className="font-bold text-base mb-1" style={{ color: S.text }}>Your Response</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>Review the variation order above and approve or reject it.</p>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAction('approve')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: action === 'approve' ? S.green : 'rgba(22,163,74,0.08)',
                  color: action === 'approve' ? '#fff' : S.green,
                  border: `1.5px solid ${action === 'approve' ? S.green : 'rgba(22,163,74,0.3)'}`,
                }}>
                <Check size={16} /> Approve
              </button>
              <button
                onClick={() => setAction('reject')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: action === 'reject' ? S.danger : 'rgba(220,38,38,0.06)',
                  color: action === 'reject' ? '#fff' : S.danger,
                  border: `1.5px solid ${action === 'reject' ? S.danger : 'rgba(220,38,38,0.2)'}`,
                }}>
                <X size={16} /> Reject
              </button>
            </div>

            {action === 'reject' && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Reason for rejection (required)…"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none mb-4"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
              />
            )}

            {action && (
              <button
                onClick={() => void submit()}
                disabled={submitting || (action === 'reject' && !notes.trim())}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: action === 'approve' ? S.green : S.danger, color: '#fff' }}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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
