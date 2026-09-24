'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Repeat, Plus, X, Check, AlertCircle, Loader2, FileText, Send, Pause, Play, Square, Pencil, Trash2, Receipt, ArrowUpRight } from 'lucide-react'
import type { ElecServiceContract, ElecContractInvoice } from '@/lib/elec-types'
import { fmtRand, planSummary, addMonths } from '@/lib/contract-format'
import { todaySA } from '@/lib/dates'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A', gold: '#B7862F',
}

interface ContractRow extends ElecServiceContract {
  stats: {
    invoiced12: number
    unpaid: number
    coveredVisits12: number
    coveredHours12: number
    workValue12: number | null
    visitsThisYear: number
    renewsInDays: number
  }
}

interface JobCardRow { id: string; job_number: string; title: string; job_type: string; status: string; contract_coverage: string | null; labour_hours: number | null; created_at: string }

const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: S.green, bg: 'rgba(22,163,74,0.1)' },
  paused: { label: 'Paused', color: S.gold, bg: 'rgba(217,164,65,0.14)' },
  ended:  { label: 'Ended', color: S.muted, bg: S.input },
}
const INVOICE_PILL: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: S.muted, bg: S.input },
  sent:  { label: 'Sent', color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)' },
  paid:  { label: 'Paid', color: S.green, bg: 'rgba(22,163,74,0.1)' },
  void:  { label: 'Void', color: S.danger, bg: 'rgba(220,38,38,0.08)' },
}
const JOB_TYPES: [string, string][] = [['maintenance', 'Maintenance'], ['callout', 'Callouts'], ['repair', 'Repairs'], ['emergency', 'Emergencies'], ['once_off', 'Once-off jobs']]

const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const monthly = (c: ElecServiceContract) => c.billing_period === 'annual' ? c.fee / 12 : c.fee

export function ContractsClient({ clients, sageConnected }: {
  clients: { id: string; client_name: string; email: string | null }[]
  sageConnected: boolean
}) {
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ElecServiceContract | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await fetch('/api/supplier-portal/quoting/contracts')
    const d = await res.json() as { contracts?: ContractRow[]; error?: string }
    if (d.contracts) setContracts(d.contracts)
    else setError(d.error ?? 'Could not load contracts')
  }, [])

  useEffect(() => {
    // Loads from the API, an external system — what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const active = (contracts ?? []).filter(c => c.status === 'active')
  const mrr = active.reduce((s, c) => s + monthly(c), 0)
  const unpaid = (contracts ?? []).reduce((s, c) => s + c.stats.unpaid, 0)
  const renewingSoon = active.filter(c => c.stats.renewsInDays <= 60).length
  const clientsOnPlans = new Set(active.map(c => c.client_id))

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--qh-accent-rgb),0.1)' }}>
              <Repeat size={18} style={{ color: S.accent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: S.text }}>Support Contracts</h1>
              <p className="text-xs" style={{ color: S.muted }}>Monthly and annual plans — invoiced automatically, renewals tracked</p>
            </div>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
            <Plus size={15} /> New plan
          </button>
        </div>

        {contracts && contracts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Monthly recurring (ex VAT)', value: fmtRand(mrr), color: S.accent },
              { label: 'Clients on a plan', value: String(clientsOnPlans.size), color: S.text },
              { label: 'Invoiced, not yet paid', value: fmtRand(unpaid), color: unpaid > 0 ? S.gold : S.text },
              { label: 'Renewing in 60 days', value: String(renewingSoon), color: S.text },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted }}>{m.label}</p>
                <p className="text-lg font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm mb-3" style={{ color: S.danger }}>{error}</p>}
        {contracts === null && !error && <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: S.accent }} /></div>}
        {contracts && contracts.length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <Repeat size={30} className="mx-auto mb-3" style={{ color: S.border }} />
            <p className="text-sm font-medium" style={{ color: S.text }}>No support plans yet</p>
            <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: S.muted }}>
              Put a client on a monthly or annual plan and the invoices raise themselves. Callouts on job cards are marked covered or chargeable, so you can see which plans pay their way.
            </p>
            <button onClick={() => setEditing('new')} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Set up the first plan
            </button>
          </div>
        )}

        {contracts && contracts.length > 0 && (
          <div className="space-y-2.5">
            {contracts.map(c => {
              const pill = STATUS_PILL[c.status]
              const earning = c.stats.workValue12 == null ? null : c.stats.invoiced12 - c.stats.workValue12
              return (
                <button key={c.id} onClick={() => setOpenId(c.id)}
                  className="w-full text-left rounded-2xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2"
                  style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: S.text }}>{c.client?.client_name ?? 'Client'}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: pill.color, background: pill.bg }}>{pill.label}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                      {c.name} · {fmtRand(c.fee)} {c.billing_period === 'annual' ? '/ year' : '/ month'}
                    </p>
                  </div>
                  <div className="text-xs" style={{ color: S.muted, minWidth: 110 }}>
                    <p style={{ color: S.text }}>{c.included_visits == null ? `${c.stats.visitsThisYear} visits` : `${c.stats.visitsThisYear} / ${c.included_visits} visits`}</p>
                    <p>this contract year</p>
                  </div>
                  <div className="text-xs" style={{ color: S.muted, minWidth: 120 }}>
                    <p style={{ color: S.text }}>{c.status === 'active' && c.next_invoice_date ? `Next invoice ${fmtDate(c.next_invoice_date)}` : 'Not invoicing'}</p>
                    <p style={{ color: c.status === 'active' && c.stats.renewsInDays <= 30 ? S.gold : S.muted }}>
                      {c.status === 'ended' ? `Ended ${fmtDate(c.renewal_date)}` : `${c.auto_renew ? 'Renews' : 'Ends'} ${fmtDate(c.renewal_date)}`}
                    </p>
                  </div>
                  <div className="text-xs text-right" style={{ minWidth: 150 }}>
                    <p style={{ color: S.text }}>{fmtRand(c.stats.invoiced12)} invoiced <span style={{ color: S.muted }}>· 12 mo</span></p>
                    {earning == null ? (
                      <p style={{ color: S.muted }}>{c.stats.coveredHours12}h of covered work</p>
                    ) : (
                      <p style={{ color: earning >= 0 ? S.green : S.danger }}>
                        {c.stats.coveredHours12}h covered ≈ {fmtRand(c.stats.workValue12 ?? 0)} — {earning >= 0 ? 'paying its way' : 'costing you'}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {editing && (
        <ContractEditor
          contract={editing === 'new' ? null : editing}
          clients={clients}
          sageConnected={sageConnected}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload() }}
        />
      )}
      {openId && (
        <ContractDetail
          id={openId}
          sageConnected={sageConnected}
          onClose={() => setOpenId(null)}
          onEdit={c => { setOpenId(null); setEditing(c) }}
          onChanged={() => void reload()}
        />
      )}
    </div>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function ContractEditor({ contract, clients, sageConnected, onClose, onSaved }: {
  contract: ElecServiceContract | null
  clients: { id: string; client_name: string }[]
  sageConnected: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const today = todaySA()
  const [clientId, setClientId] = useState(contract?.client_id ?? '')
  const [name, setName] = useState(contract?.name ?? '')
  const [period, setPeriod] = useState<'monthly' | 'annual'>(contract?.billing_period ?? 'monthly')
  const [fee, setFee] = useState(contract ? String(contract.fee) : '')
  const [visits, setVisits] = useState(contract?.included_visits != null ? String(contract.included_visits) : '')
  const [calloutRate, setCalloutRate] = useState(contract?.callout_rate != null ? String(contract.callout_rate) : '')
  const [types, setTypes] = useState<string[]>(contract?.covered_job_types ?? ['maintenance', 'callout', 'repair'])
  const [remote, setRemote] = useState(contract?.includes_remote_support ?? true)
  const [response, setResponse] = useState(contract?.response_time ?? '')
  const [start, setStart] = useState(contract?.start_date ?? today)
  const [renewal, setRenewal] = useState(contract?.renewal_date ?? addMonths(today, 12))
  const [firstInvoice, setFirstInvoice] = useState(contract?.next_invoice_date ?? today)
  const [autoRenew, setAutoRenew] = useState(contract?.auto_renew ?? true)
  const [notes, setNotes] = useState(contract?.notes ?? '')
  const [sageCustomer, setSageCustomer] = useState<{ id: string; name: string } | null>(
    contract?.sage_customer_id ? { id: contract.sage_customer_id, name: contract.sage_customer_name ?? '' } : null)
  const [sageList, setSageList] = useState<{ id: string; name: string }[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sageConnected) return
    fetch('/api/supplier-portal/quoting/sage/customers')
      .then(r => r.json())
      .then((d: { customers?: { id: string; name: string }[] }) => setSageList(d.customers ?? []))
      .catch(() => setSageList([]))
  }, [sageConnected])

  async function save() {
    setSaving(true); setError('')
    const body = {
      ...(contract ? {} : { client_id: clientId }),
      name, billing_period: period, fee, included_visits: visits, callout_rate: calloutRate,
      covered_job_types: types, includes_remote_support: remote, response_time: response,
      start_date: start, renewal_date: renewal, auto_renew: autoRenew, notes,
      ...(contract?.status === 'active' || !contract ? { next_invoice_date: firstInvoice } : {}),
      sage_customer_id: sageCustomer?.id ?? '', sage_customer_name: sageCustomer?.name ?? '',
    }
    const res = await fetch(contract ? `/api/supplier-portal/quoting/contracts/${contract.id}` : '/api/supplier-portal/quoting/contracts', {
      method: contract ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({})) as { error?: string }
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Could not save the plan'); return }
    onSaved()
  }

  const label = 'block text-[10px] font-semibold uppercase tracking-wider mb-1'
  const input = 'w-full px-3 py-2.5 text-sm rounded-xl outline-none'
  const inputStyle = { background: S.input, border: `1px solid ${S.border}`, color: S.text }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="w-full sm:max-w-2xl max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl" style={{ background: S.card, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: S.text }}>{contract ? 'Edit plan' : 'New support plan'}</h2>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {!contract && (
            <div>
              <label htmlFor="c-client" className={label} style={{ color: S.muted }}>Client *</label>
              <select id="c-client" value={clientId} onChange={e => setClientId(e.target.value)} className={input} style={inputStyle}>
                <option value="">Choose a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select>
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label htmlFor="c-name" className={label} style={{ color: S.muted }}>Plan name *</label>
              <input id="c-name" value={name} onChange={e => setName(e.target.value)} className={input} style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: S.muted }}>What the client sees on the invoice, e.g. &ldquo;Gold Support&rdquo;</p>
            </div>
            <div>
              <label htmlFor="c-fee" className={label} style={{ color: S.muted }}>Fee (R, ex VAT) *</label>
              <input id="c-fee" type="number" min={0} step="0.01" value={fee} onChange={e => setFee(e.target.value)} className={input} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="c-period" className={label} style={{ color: S.muted }}>Billed</label>
              <select id="c-period" value={period} onChange={e => setPeriod(e.target.value as 'monthly' | 'annual')} className={input} style={inputStyle}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annually</option>
              </select>
            </div>
            <div>
              <label htmlFor="c-visits" className={label} style={{ color: S.muted }}>Visits a year</label>
              <input id="c-visits" type="number" min={0} step={1} value={visits} onChange={e => setVisits(e.target.value)} className={input} style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: S.muted }}>Blank = unlimited</p>
            </div>
          </div>

          <div>
            <p className={label} style={{ color: S.muted }}>Covers these job types</p>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map(([v, l]) => {
                const on = types.includes(v)
                return (
                  <button key={v} type="button" aria-pressed={on}
                    onClick={() => setTypes(t => on ? t.filter(x => x !== v) : [...t, v])}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: on ? 'rgba(var(--qh-accent-rgb),0.1)' : S.input, color: on ? S.accent : S.muted, border: `1px solid ${on ? S.accent : S.border}` }}>
                    {on && <Check size={11} className="inline mr-1" />}{l}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="c-rate" className={label} style={{ color: S.muted }}>Rate for other work (R/hour)</label>
              <input id="c-rate" type="number" min={0} step="0.01" value={calloutRate} onChange={e => setCalloutRate(e.target.value)} className={input} style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: S.muted }}>Charged when a visit isn&apos;t covered — and used to value the covered work you give</p>
            </div>
            <div>
              <label htmlFor="c-response" className={label} style={{ color: S.muted }}>Response time</label>
              <input id="c-response" value={response} onChange={e => setResponse(e.target.value)} className={input} style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: S.muted }}>e.g. next business day</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: S.text }}>
            <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} /> Remote support included
          </label>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="c-start" className={label} style={{ color: S.muted }}>Start date *</label>
              <input id="c-start" type="date" value={start}
                onChange={e => { setStart(e.target.value); if (!contract && e.target.value) { setRenewal(addMonths(e.target.value, 12)); setFirstInvoice(e.target.value) } }}
                className={input} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="c-renewal" className={label} style={{ color: S.muted }}>Renewal date *</label>
              <input id="c-renewal" type="date" value={renewal} onChange={e => setRenewal(e.target.value)} className={input} style={inputStyle} />
            </div>
            {(!contract || contract.status === 'active') && (
              <div>
                <label htmlFor="c-first" className={label} style={{ color: S.muted }}>{contract ? 'Next invoice' : 'First invoice'}</label>
                <input id="c-first" type="date" value={firstInvoice} onChange={e => setFirstInvoice(e.target.value)} className={input} style={inputStyle} />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: S.text }}>
            <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} /> Renews automatically each year
          </label>

          {sageConnected && (
            <div>
              <label htmlFor="c-sage" className={label} style={{ color: S.muted }}>Sage customer</label>
              {sageList === null ? (
                <p className="text-xs flex items-center gap-1.5" style={{ color: S.muted }}><Loader2 size={12} className="animate-spin" /> Loading Sage customers…</p>
              ) : (
                <select id="c-sage" value={sageCustomer?.id ?? ''}
                  onChange={e => setSageCustomer(sageList.find(c => c.id === e.target.value) ?? null)}
                  className={input} style={inputStyle}>
                  <option value="">Not linked — invoices stay in QuotingHub</option>
                  {sageCustomer && !sageList.some(c => c.id === sageCustomer.id) && <option value={sageCustomer.id}>{sageCustomer.name}</option>}
                  {sageList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div>
            <label htmlFor="c-notes" className={label} style={{ color: S.muted }}>Notes</label>
            <textarea id="c-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${input} resize-none`} style={inputStyle} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
              <AlertCircle size={13} />{error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>Cancel</button>
          <button onClick={() => void save()} disabled={saving || !name.trim() || (!contract && !clientId)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: S.accent }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : contract ? 'Save plan' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function ContractDetail({ id, sageConnected, onClose, onEdit, onChanged }: {
  id: string
  sageConnected: boolean
  onClose: () => void
  onEdit: (c: ElecServiceContract) => void
  onChanged: () => void
}) {
  const [data, setData] = useState<{ contract: ElecServiceContract; invoices: ElecContractInvoice[]; jobCards: JobCardRow[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/supplier-portal/quoting/contracts/${id}`)
    const d = await res.json() as { contract?: ElecServiceContract; invoices?: ElecContractInvoice[]; jobCards?: JobCardRow[]; error?: string }
    if (d.contract) setData({ contract: d.contract, invoices: d.invoices ?? [], jobCards: d.jobCards ?? [] })
    else setMessage({ text: d.error ?? 'Could not load the plan', ok: false })
  }, [id])

  useEffect(() => {
    // Loads from the API, an external system — what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function act(key: string, url: string, init: RequestInit, done: string) {
    setBusy(key); setMessage(null)
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
    const d = await res.json().catch(() => ({})) as { error?: string }
    setBusy(null)
    if (!res.ok) { setMessage({ text: d.error ?? 'Something went wrong', ok: false }); return false }
    setMessage({ text: done, ok: true })
    await load(); onChanged()
    return true
  }

  const c = data?.contract
  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50'
  const plain = { background: S.card, color: S.text, border: `1px solid ${S.border}` }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl h-full overflow-y-auto" style={{ background: S.bg }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: S.text }}>{c?.client?.client_name ?? 'Support plan'}</p>
            {c && <p className="text-xs" style={{ color: S.muted }}>{c.name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={16} /></button>
        </div>

        {!c ? (
          <div className="py-16 flex justify-center"><Loader2 size={20} className="animate-spin" style={{ color: S.accent }} /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <p className="text-sm" style={{ color: S.text }}>{planSummary(c)}</p>
              <p className="text-xs mt-2" style={{ color: S.muted }}>
                Started {fmtDate(c.start_date)} · {c.status === 'ended' ? `ended ${fmtDate(c.renewal_date)}` : `${c.auto_renew ? 'renews' : 'ends'} ${fmtDate(c.renewal_date)}`}
                {c.status === 'active' && c.next_invoice_date ? ` · next invoice ${fmtDate(c.next_invoice_date)}` : ''}
                {c.sage_customer_name ? ` · Sage: ${c.sage_customer_name}` : ''}
              </p>
              {c.notes && <p className="text-xs mt-2 italic" style={{ color: S.muted }}>{c.notes}</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                <button className={btn} style={plain} onClick={() => onEdit(c)}><Pencil size={12} /> Edit</button>
                {c.status === 'active' && c.next_invoice_date && (
                  <button className={btn} style={{ background: S.accent, color: '#fff' }} disabled={busy !== null}
                    onClick={() => void act('raise', `/api/supplier-portal/quoting/contracts/${c.id}/raise-invoice`, { method: 'POST' }, 'Invoice raised')}>
                    {busy === 'raise' ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />} Invoice next period now
                  </button>
                )}
                {c.status === 'active' && (
                  <button className={btn} style={plain} disabled={busy !== null}
                    onClick={() => void act('pause', `/api/supplier-portal/quoting/contracts/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paused' }) }, 'Plan paused — no invoices until you resume it')}>
                    <Pause size={12} /> Pause
                  </button>
                )}
                {c.status !== 'active' && (
                  <button className={btn} style={plain} disabled={busy !== null}
                    onClick={() => void act('resume', `/api/supplier-portal/quoting/contracts/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active', next_invoice_date: todaySA() }) }, 'Plan active — invoicing from today')}>
                    <Play size={12} /> Resume
                  </button>
                )}
                {c.status !== 'ended' && (
                  <button className={btn} style={{ ...plain, color: S.danger }} disabled={busy !== null}
                    onClick={() => { if (confirm('End this plan? It stops invoicing and stops covering job cards.')) void act('end', `/api/supplier-portal/quoting/contracts/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ended' }) }, 'Plan ended') }}>
                    <Square size={12} /> End plan
                  </button>
                )}
                {data.invoices.length === 0 && (
                  <button className={btn} style={{ ...plain, color: S.danger }} disabled={busy !== null}
                    onClick={async () => { if (confirm('Delete this plan?') && await act('delete', `/api/supplier-portal/quoting/contracts/${c.id}`, { method: 'DELETE' }, 'Deleted')) onClose() }}>
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
              {message && (
                <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: message.ok ? S.green : S.danger }}>
                  {message.ok ? <Check size={12} /> : <AlertCircle size={12} />}{message.text}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Invoices</p>
              {data.invoices.length === 0 ? (
                <p className="text-sm rounded-xl p-4" style={{ background: S.card, color: S.muted, border: `1px solid ${S.border}` }}>
                  None yet. The first one is raised on {fmtDate(c.next_invoice_date)}.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.invoices.map(inv => {
                    const pill = INVOICE_PILL[inv.status]
                    const total = inv.amount * (1 + inv.vat_rate / 100)
                    return (
                      <div key={inv.id} className="rounded-xl p-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold font-mono" style={{ color: S.text }}>{inv.invoice_number}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: pill.color, background: pill.bg }}>{pill.label}</span>
                          {inv.sage_invoice_id && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: S.muted, background: S.input }}>In Sage</span>}
                          <span className="ml-auto text-sm font-semibold" style={{ color: S.text }}>{fmtRand(total)}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: S.muted }}>{fmtDate(inv.period_start)} – {fmtDate(inv.period_end)} · incl. VAT</p>
                        {inv.status !== 'void' && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <a href={`/api/supplier-portal/quoting/contract-invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className={btn} style={plain}>
                              <FileText size={12} /> PDF
                            </a>
                            <button className={btn} style={plain} disabled={busy !== null}
                              onClick={() => void act(`send-${inv.id}`, `/api/supplier-portal/quoting/contract-invoices/${inv.id}/send`, { method: 'POST', body: '{}' }, `Emailed ${inv.invoice_number}`)}>
                              {busy === `send-${inv.id}` ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {inv.sent_at ? 'Resend' : 'Send'}
                            </button>
                            {sageConnected && c.sage_customer_id && (
                              <button className={btn} style={plain} disabled={busy !== null}
                                onClick={() => void act(`sage-${inv.id}`, `/api/supplier-portal/quoting/contract-invoices/${inv.id}/sage`, { method: 'POST' }, `${inv.invoice_number} is in Sage`)}>
                                {busy === `sage-${inv.id}` ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />} {inv.sage_invoice_id ? 'Update Sage' : 'Push to Sage'}
                              </button>
                            )}
                            {inv.status !== 'paid' && (
                              <button className={btn} style={{ ...plain, color: S.green }} disabled={busy !== null}
                                onClick={() => void act(`paid-${inv.id}`, `/api/supplier-portal/quoting/contract-invoices/${inv.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) }, `${inv.invoice_number} marked paid`)}>
                                <Check size={12} /> Mark paid
                              </button>
                            )}
                            {inv.status !== 'paid' && (
                              <button className={btn} style={{ ...plain, color: S.danger }} disabled={busy !== null}
                                onClick={() => { if (confirm(`Void ${inv.invoice_number}?`)) void act(`void-${inv.id}`, `/api/supplier-portal/quoting/contract-invoices/${inv.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'void' }) }, `${inv.invoice_number} voided`) }}>
                                <X size={12} /> Void
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Visits under this plan</p>
              {data.jobCards.length === 0 ? (
                <p className="text-sm rounded-xl p-4" style={{ background: S.card, color: S.muted, border: `1px solid ${S.border}` }}>
                  No job cards yet. New job cards for this client are marked covered or chargeable automatically.
                </p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  {data.jobCards.map((j, i) => (
                    <Link key={j.id} href={`/supplier-portal/quoting/job-cards/${j.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm" style={{ borderTop: i ? `1px solid ${S.border}` : undefined }}>
                      <span className="font-mono text-xs" style={{ color: S.muted }}>{j.job_number}</span>
                      <span className="flex-1 truncate" style={{ color: S.text }}>{j.title}</span>
                      {j.labour_hours != null && <span className="text-xs" style={{ color: S.muted }}>{j.labour_hours}h</span>}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={j.contract_coverage === 'covered' ? { color: S.green, background: 'rgba(22,163,74,0.1)' } : { color: S.gold, background: 'rgba(217,164,65,0.14)' }}>
                        {j.contract_coverage === 'covered' ? 'Covered' : 'Charged'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
