'use client'
import { useState } from 'react'
import { Receipt, CheckCircle, AlertCircle, Plus, Trash2, X } from 'lucide-react'
import type { MfgInvoice } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5' }

const STATUS_CONFIG = {
  draft:          { label: 'Draft',   color: '#71717A', bg: '#F4F4F5' },
  sent:           { label: 'Sent',    color: '#D97706', bg: '#FEF3C7' },
  partially_paid: { label: 'Partial', color: '#2563EB', bg: '#EFF6FF' },
  paid:           { label: 'Paid',    color: '#16A34A', bg: '#DCFCE7' },
  overdue:        { label: 'Overdue', color: '#DC2626', bg: '#FEE2E2' },
}

type InvoiceWithJob = MfgInvoice & { job?: { id: string; job_name: string; client?: { client_name: string } | null } | null }

interface PaymentForm { amount: string; payment_date: string; payment_method: string; reference: string }

interface Props { initialInvoices: InvoiceWithJob[] }

export function MfgInvoicesClient({ initialInvoices }: Props) {
  const [invoices, setInvoices] = useState<InvoiceWithJob[]>(initialInvoices)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [addingPayment, setAddingPayment] = useState<string | null>(null)
  const [paymentForm, setPaymentForm]     = useState<PaymentForm>({ amount: '', payment_date: '', payment_method: 'eft', reference: '' })
  const [payments, setPayments]           = useState<Record<string, { id: string; amount: number; payment_date: string; payment_method: string; reference: string | null }[]>>({})
  const [loadingPayments, setLoadingPayments] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ invoiceId: string; paymentId: string } | null>(null)

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    const clientName = inv.job?.client?.client_name?.toLowerCase() ?? ''
    if (search && !clientName.includes(search.toLowerCase()) && !inv.invoice_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function daysDue(dateStr: string | null) {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  async function loadPayments(invoiceId: string) {
    if (payments[invoiceId]) return
    setLoadingPayments(invoiceId)
    const res = await fetch(`/api/supplier-portal/manufacturing/invoices/${invoiceId}`)
    setLoadingPayments(null)
    if (!res.ok) return
    const d = await res.json()
    setPayments(prev => ({ ...prev, [invoiceId]: d.payments ?? [] }))
  }

  async function handleExpand(invoiceId: string) {
    if (expandedId === invoiceId) { setExpandedId(null); return }
    setExpandedId(invoiceId)
    await loadPayments(invoiceId)
  }

  function openPaymentModal(invoiceId: string, balance: number) {
    setPaymentForm({ amount: balance.toFixed(2), payment_date: new Date().toISOString().split('T')[0], payment_method: 'eft', reference: '' })
    setAddingPayment(invoiceId)
  }

  async function handleAddPayment() {
    if (!addingPayment || !paymentForm.amount) return
    setSaving(true)
    const res = await fetch(`/api/supplier-portal/manufacturing/invoices/${addingPayment}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date || new Date().toISOString().split('T')[0],
        payment_method: paymentForm.payment_method || 'eft',
        reference: paymentForm.reference || null,
      }),
    })
    setSaving(false)
    if (!res.ok) return
    const newPayment = await res.json()
    const invoiceId = addingPayment
    setPayments(prev => ({ ...prev, [invoiceId]: [...(prev[invoiceId] ?? []), newPayment] }))
    const invRes = await fetch(`/api/supplier-portal/manufacturing/invoices/${invoiceId}`)
    if (invRes.ok) {
      const updated = await invRes.json()
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: updated.status, amount_paid: updated.amount_paid } : inv))
    }
    setAddingPayment(null)
  }

  async function handleDeletePayment(invoiceId: string, paymentId: string) {
    await fetch(`/api/supplier-portal/manufacturing/invoices/${invoiceId}/payments?payment_id=${paymentId}`, { method: 'DELETE' })
    setPayments(prev => ({ ...prev, [invoiceId]: (prev[invoiceId] ?? []).filter(p => p.id !== paymentId) }))
    const res = await fetch(`/api/supplier-portal/manufacturing/invoices/${invoiceId}`)
    if (res.ok) {
      const updated = await res.json()
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: updated.status, amount_paid: updated.amount_paid } : inv))
    }
    setConfirmDelete(null)
  }

  const totalOutstanding = filtered.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total - i.amount_paid), 0)

  return (
    <div>
      {/* Outstanding summary */}
      {totalOutstanding > 0 && (
        <div className="flex items-center justify-between px-5 py-3 rounded-xl mb-6"
          style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <span className="text-sm font-semibold" style={{ color: '#92400E' }}>Outstanding</span>
          <span className="text-lg font-bold" style={{ color: '#92400E' }}>
            R {totalOutstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices, clients…"
          className="flex-1 min-w-[180px] px-3.5 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {(['all','sent','partially_paid','overdue','paid'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: statusFilter === s ? S.accent : S.card, color: statusFilter === s ? '#fff' : S.muted }}>
              {s === 'all' ? 'All' : s === 'partially_paid' ? 'Partial' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: S.muted }}>
          <Receipt size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No invoices yet. Convert an accepted quote to create your first invoice.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => {
            const cfg = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
            const balance = inv.total - inv.amount_paid
            const daysD = daysDue(inv.due_date)
            const isExpanded = expandedId === inv.id
            const invPayments = payments[inv.id] ?? []

            return (
              <div key={inv.id} className="rounded-2xl overflow-hidden transition-all"
                style={{ border: `1px solid ${inv.status === 'overdue' ? '#FECACA' : S.border}`, background: S.card }}>

                {/* Invoice row */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                  onClick={() => handleExpand(inv.id)}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                    <Receipt size={15} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: S.text }}>{inv.invoice_number}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      {inv.invoice_type !== 'full' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#F4F4F5', color: S.muted }}>
                          {inv.invoice_type === 'deposit' ? 'Deposit' : 'Final'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: S.muted }}>
                      {inv.job?.client?.client_name && <span className="font-medium">{inv.job.client.client_name} · </span>}
                      {inv.job?.job_name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: S.text }}>R {inv.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                    {inv.status !== 'paid' && balance > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: inv.status === 'overdue' ? '#DC2626' : S.muted }}>
                        Balance: R {balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        {daysD !== null && daysD < 0 && ` · ${Math.abs(daysD)}d overdue`}
                        {daysD !== null && daysD >= 0 && ` · due in ${daysD}d`}
                      </p>
                    )}
                    {inv.status === 'paid' && (
                      <p className="text-xs mt-0.5 flex items-center justify-end gap-1" style={{ color: '#16A34A' }}>
                        <CheckCircle size={10} /> Paid in full
                      </p>
                    )}
                  </div>
                  <a href={`/api/supplier-portal/manufacturing/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors"
                    style={{ background: S.input, color: S.muted, border: `1px solid ${S.border}` }}>
                    PDF
                  </a>
                </div>

                {/* Expanded payment history */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t space-y-3" style={{ borderColor: S.border, background: '#FAFBFC' }}>
                    <p className="text-xs font-bold uppercase tracking-widest pt-4" style={{ color: S.muted }}>Payments</p>

                    {loadingPayments === inv.id ? (
                      <p className="text-xs" style={{ color: S.muted }}>Loading…</p>
                    ) : invPayments.length === 0 ? (
                      <p className="text-xs" style={{ color: S.muted }}>No payments recorded yet.</p>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                        {invPayments.map((p, idx) => (
                          <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 text-xs"
                            style={{ background: S.card, borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}>
                            <span style={{ color: S.text }}>R {p.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            <span style={{ color: S.muted }}>{p.payment_date}</span>
                            <span className="capitalize px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#EFF6FF', color: S.accent }}>{p.payment_method}</span>
                            {p.reference && <span style={{ color: S.muted }}>{p.reference}</span>}
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete({ invoiceId: inv.id, paymentId: p.id }) }}
                              className="ml-auto" style={{ color: S.muted }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        {inv.amount_paid > 0 && (
                          <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold"
                            style={{ background: '#F0FDF4', borderTop: `1px solid ${S.border}` }}>
                            <span style={{ color: '#16A34A' }}>Total paid</span>
                            <span style={{ color: '#16A34A' }}>R {inv.amount_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {inv.status !== 'paid' && (
                      <button onClick={e => { e.stopPropagation(); openPaymentModal(inv.id, balance) }}
                        className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                        style={{ background: S.input, color: S.accent, border: `1px solid ${S.border}` }}>
                        <Plus size={12} /> Record Payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Record Payment modal */}
      {addingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setAddingPayment(null)}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: S.text }}>Record Payment</h3>
              <button onClick={() => setAddingPayment(null)} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Amount (R)</label>
                <input type="number" min={0.01} step={0.01}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Date</label>
                <input type="date"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                  <option value="eft">EFT</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Reference</label>
                <input type="text"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                  placeholder="e.g. INV-001" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => void handleAddPayment()} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#16A34A' }}>
                <CheckCircle size={14} /> {saving ? 'Saving…' : 'Record Payment'}
              </button>
              <button onClick={() => setAddingPayment(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete payment confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmDelete(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: S.text }}>Remove payment?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>This will update the invoice balance and status.</p>
            <div className="flex gap-3">
              <button onClick={() => void handleDeletePayment(confirmDelete.invoiceId, confirmDelete.paymentId)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#DC2626' }}>
                Remove
              </button>
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
