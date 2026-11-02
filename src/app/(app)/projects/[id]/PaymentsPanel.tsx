'use client'
import { useState } from 'react'
import { Wallet, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { todaySA } from '@/lib/dates'
import { formatZAR } from '@/lib/quoting'
import { PAYMENT_METHOD_LABELS } from '@/lib/statement'
import type { PaymentMethod, ProjectPayment, ProjectStages, ProjectStatus } from '@/lib/types'

interface Props {
  projectId: string
  initialPayments: ProjectPayment[]
  /** Project total incl. VAT — what the invoice says is owed. */
  total: number
  /** Called after every add/delete with the new paid total, and stage/status if they moved. */
  onChange: (paid: number | null, stages: ProjectStages | null, newStatus: ProjectStatus) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FIELD = 'px-3 py-2 border border-[#D8D3C8] rounded-lg text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] bg-white transition-colors'

/**
 * Each payment the client has made on this project (statements switch only).
 * The sum is what invoices print as received — the database keeps
 * projects.deposit_amount_received in step with this list.
 */
export function PaymentsPanel({ projectId, initialPayments, total, onChange }: Props) {
  const [payments, setPayments] = useState(initialPayments)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todaySA())
  const [method, setMethod] = useState<PaymentMethod>('eft')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = total - paid

  async function apply(res: Response, success: string) {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Could not save the payment'); return false }
    setPayments(data.payments)
    onChange(data.paid, data.stages, data.newStatus)
    toast.success(success)
    return true
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!(value > 0)) { toast.error('Enter an amount greater than zero'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, paid_on: paidOn, method, reference }),
      })
      if (await apply(res, `Payment of ${formatZAR(value)} recorded`)) {
        setAmount('')
        setReference('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setConfirmingId(null)
    const res = await fetch(`/api/projects/${projectId}/payments?paymentId=${id}`, { method: 'DELETE' })
    await apply(res, 'Payment removed')
  }

  return (
    <div className="px-4 md:px-8 mt-6 border-t border-[#EDE9E1] pt-6">
      <div className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">
        <Wallet size={13} /> Payments
      </div>

      <form onSubmit={add} className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs text-[#8A877F]">
          Amount (R)
          <input
            type="number" min="0.01" step="0.01" required
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`${FIELD} w-32 text-right`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8A877F]">
          Date
          <input type="date" required value={paidOn} onChange={e => setPaidOn(e.target.value)} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8A877F]">
          Method
          <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className={`${FIELD} cursor-pointer`}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(m => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8A877F] flex-1 min-w-[140px]">
          Reference
          <input type="text" maxLength={200} value={reference} onChange={e => setReference(e.target.value)} className={FIELD} />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] focus-visible:ring-2 focus-visible:ring-[#9A7B4F] active:bg-black transition-colors disabled:opacity-50 cursor-pointer font-medium"
        >
          {saving ? 'Saving…' : 'Record payment'}
        </button>
      </form>

      <div className="bg-white border border-[#D8D3C8] rounded">
        {payments.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#8A877F]">No payments recorded yet.</p>
        ) : (
          <ul>
            {payments.map(p => (
              <li key={p.id} className="flex items-center gap-4 px-4 py-2.5 text-sm border-b border-[#F2EFE9] last:border-0">
                <span className="w-28 shrink-0 text-[#2C2C2A]">{formatDate(p.paid_on)}</span>
                <span className="flex-1 min-w-0 truncate text-[#8A877F]">
                  {[p.method ? PAYMENT_METHOD_LABELS[p.method] : null, p.reference, p.note].filter(Boolean).join(' · ') || '—'}
                </span>
                <span className="font-medium text-green-700">{formatZAR(Number(p.amount))}</span>
                {confirmingId === p.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    <button onClick={() => remove(p.id)} className="text-red-700 hover:underline focus-visible:underline cursor-pointer">Remove</button>
                    <button onClick={() => setConfirmingId(null)} className="text-[#8A877F] hover:text-[#2C2C2A] focus-visible:text-[#2C2C2A] cursor-pointer">Keep</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmingId(p.id)}
                    aria-label={`Remove payment of ${formatZAR(Number(p.amount))}`}
                    className="text-[#C4BFB5] hover:text-red-700 focus-visible:text-red-700 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-6 px-4 py-2.5 text-sm border-t border-[#D8D3C8] bg-[#FAF8F4]">
          <span className="text-[#8A877F]">Paid <span className="font-medium text-green-700">{formatZAR(paid)}</span></span>
          <span className="text-[#8A877F]">
            {balance < 0 ? 'In credit' : 'Balance'}{' '}
            <span className="font-semibold text-[#2C2C2A]">{formatZAR(Math.abs(balance))}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
