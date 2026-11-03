'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, RefreshCw, Check, AlertTriangle, ChevronDown, ChevronRight, RotateCcw, Inbox } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export interface MailboxInfo {
  agent_name: string
  email: string
  last_checked_at: string | null
  last_error: string | null
}

interface ExtractedLine {
  description: string
  code: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
}

interface Extracted {
  supplier_name: string | null
  reference: string | null
  document_date: string | null
  valid_until: string | null
  client_or_project_reference: string | null
  currency: string | null
  subtotal_excl_vat: number | null
  vat: number | null
  total_incl_vat: number | null
  lead_time: string | null
  lines: ExtractedLine[]
}

export interface AgentEmailRow {
  id: string
  from_email: string | null
  from_name: string | null
  subject: string | null
  received_at: string | null
  kind: string | null
  supplier_id: string | null
  supplier_guess: string | null
  project_id: string | null
  rfq_request_id: string | null
  match_confidence: 'high' | 'medium' | 'low' | null
  match_reason: string | null
  summary: string | null
  action_needed: string | null
  status: 'new' | 'done' | 'error'
  error: string | null
  agent_documents: {
    id: string
    filename: string
    doc_type: string | null
    extracted: Extracted | null
    read_error: string | null
    storage_path: string | null
  }[]
}

interface Option { id: string; label: string }

const KIND_LABELS: Record<string, string> = {
  supplier_quote: 'Quote',
  proforma: 'Pro forma',
  invoice: 'Invoice',
  order_confirmation: 'Order confirmed',
  delivery: 'Delivery',
  stock_or_lead_time: 'Stock / lead time',
  price_list: 'Price list',
  rfq_reply: 'RFQ reply',
  other: 'Other',
  not_supplier: 'Not a supplier',
}

const rand = (n: number | null, currency?: string | null) =>
  n == null ? '—' : `${currency && currency !== 'ZAR' ? currency + ' ' : 'R '}${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

const selectClass = 'w-full text-sm px-2.5 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] cursor-pointer'

export function AssistantView({ mailbox, emails, projects, suppliers }: {
  mailbox: MailboxInfo | null
  emails: AgentEmailRow[]
  projects: Option[]
  suppliers: Option[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'needs' | 'all'>('needs')
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showConnect, setShowConnect] = useState(!mailbox)

  const name = mailbox?.agent_name ?? 'Assistant'
  const needs = useMemo(() => emails.filter(e => e.status !== 'done'), [emails])
  const shown = tab === 'needs' ? needs : emails

  async function checkNow() {
    setChecking(true)
    setMessage(null)
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setMessage(data.error ?? 'Could not check the inbox')
      else {
        const s = data.summary
        setMessage(s.read === 0 ? 'No new mail.' : `Read ${s.read}: ${s.filed} filed${s.failed ? `, ${s.failed} could not be read` : ''}${s.skipped ? `, ${s.skipped} already filed` : ''}.`)
      }
      router.refresh()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={name}
        subtitle={mailbox ? `Reads ${mailbox.email} and files supplier mail to projects` : 'Connect a Gmail inbox to start'}
        count={mailbox ? needs.length : undefined}
        actions={mailbox && (
          <Button size="sm" onClick={checkNow} disabled={checking}>
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Check now'}
          </Button>
        )}
      />

      <div className="p-4 md:p-8 space-y-4 max-w-5xl">
        {mailbox && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8A877F]">
            <span>Last checked {mailbox.last_checked_at ? when(mailbox.last_checked_at) : 'never'}</span>
            <button className="underline hover:text-[#2C2C2A] cursor-pointer" onClick={() => setShowConnect(v => !v)}>
              {showConnect ? 'Hide inbox settings' : 'Inbox settings'}
            </button>
            {message && <span className="text-[#2C2C2A]">{message}</span>}
          </div>
        )}

        {mailbox?.last_error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#E8C4B8] bg-[#FBEFEA] px-4 py-3 text-sm text-[#8A3A22]">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>The last check failed: {mailbox.last_error}</span>
          </div>
        )}

        {showConnect && <ConnectForm mailbox={mailbox} onDone={() => { setShowConnect(false); router.refresh() }} />}

        {mailbox && (
          <>
            <div className="flex gap-1 border-b border-[#D8D3C8]">
              {([['needs', `Needs you (${needs.length})`], ['all', `All mail (${emails.length})`]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-2 text-sm -mb-px border-b-2 cursor-pointer transition-colors ${tab === key ? 'border-[#9A7B4F] text-[#2C2C2A]' : 'border-transparent text-[#8A877F] hover:text-[#2C2C2A]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#8A877F]">
                <Inbox size={20} className="mx-auto mb-2 opacity-50" />
                {tab === 'needs' ? 'Nothing waiting. Everything is filed.' : `Nothing in ${name}'s inbox yet. Forward a supplier email to ${mailbox.email} and press Check now.`}
              </div>
            ) : (
              <div className="space-y-3">
                {shown.map(e => <EmailCard key={e.id} email={e} projects={projects} suppliers={suppliers} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ConnectForm({ mailbox, onDone }: { mailbox: MailboxInfo | null; onDone: () => void }) {
  const [agentName, setAgentName] = useState(mailbox?.agent_name ?? 'Mia')
  const [email, setEmail] = useState(mailbox?.email ?? '')
  const [appPassword, setAppPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Only the name changed: no need to re-enter the password.
      const renameOnly = mailbox && email.trim().toLowerCase() === mailbox.email && !appPassword
      const res = await fetch('/api/agent/mailbox', {
        method: renameOnly ? 'PATCH' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renameOnly ? { agentName } : { agentName, email, appPassword }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Could not save')
      else onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#D8D3C8] bg-white p-5 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-[#1A1A18]">{mailbox ? 'Inbox settings' : 'Connect the assistant’s inbox'}</h2>
        <ol className="mt-2 text-xs leading-relaxed text-[#4A4A47] list-decimal pl-4 space-y-0.5">
          <li>Create a Gmail account for the assistant and turn on 2-Step Verification.</li>
          <li>Go to myaccount.google.com/apppasswords, create one called QuotingHub, and paste the 16 letters below.</li>
          <li>In the studio inboxes, add a Gmail filter that forwards supplier mail to this address.</li>
        </ol>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="Name" value={agentName} onChange={e => setAgentName(e.target.value)} />
        <Input label="Gmail address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <div>
          <Input label="App password" type="password" autoComplete="new-password" value={appPassword} onChange={e => setAppPassword(e.target.value)} />
          {mailbox && <p className="text-[11px] text-[#8A877F] mt-1">Leave blank to keep the current one.</p>}
        </div>
      </div>
      {error && <p className="text-sm text-[#B4472F]">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Checking with Gmail…' : mailbox ? 'Save' : 'Connect'}</Button>
      </div>
    </div>
  )
}

function EmailCard({ email: e, projects, suppliers }: { email: AgentEmailRow; projects: Option[]; suppliers: Option[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/agent/emails/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) setError((await res.json()).error ?? 'Could not save')
    setBusy(false)
    router.refresh()
  }

  async function readAgain() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/agent/emails/${e.id}`, { method: 'POST' })
    if (!res.ok) setError((await res.json()).error ?? 'Could not read it')
    setBusy(false)
    router.refresh()
  }

  const lowMatch = e.match_confidence === 'low'

  return (
    <div className={`rounded-xl border bg-white ${e.status === 'error' ? 'border-[#E8C4B8]' : 'border-[#D8D3C8]'}`}>
      <div className="px-4 py-3 flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            {e.kind && (
              <span className="text-[10px] font-medium uppercase tracking-widest text-[#7E6036] bg-[#F3ECDF] px-1.5 py-0.5 rounded">
                {KIND_LABELS[e.kind] ?? e.kind}
              </span>
            )}
            <span className="text-sm font-medium text-[#2C2C2A]">{e.from_name || e.from_email}</span>
            <span className="text-xs text-[#8A877F]">{when(e.received_at)}</span>
          </div>
          <p className="text-sm text-[#4A4A47] mt-0.5">{e.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {e.status === 'error' && (
            <Button size="sm" variant="secondary" onClick={readAgain} disabled={busy}><RotateCcw size={12} /> Read again</Button>
          )}
          {e.status === 'new' && (
            <Button size="sm" variant="secondary" onClick={() => patch({ status: 'done' })} disabled={busy}><Check size={12} /> Done</Button>
          )}
          {e.status === 'done' && <span className="text-xs text-[#5B7F4F] flex items-center gap-1"><Check size={12} /> Filed</span>}
        </div>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {e.status === 'error' && (
          <p className="text-sm text-[#8A3A22]">Could not read this email: {e.error}</p>
        )}
        {e.summary && <p className="text-sm text-[#2C2C2A]">{e.summary}</p>}
        {e.action_needed && (
          <p className="text-sm text-[#7A5F35] bg-[#FBF5EA] border border-[#EADBC0] rounded-md px-3 py-1.5">{e.action_needed}</p>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Project</span>
            <select className={selectClass} value={e.project_id ?? ''} disabled={busy} onChange={ev => patch({ project_id: ev.target.value || null })}>
              <option value="">Not filed to a project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Supplier</span>
            <select className={selectClass} value={e.supplier_id ?? ''} disabled={busy} onChange={ev => patch({ supplier_id: ev.target.value || null })}>
              <option value="">{e.supplier_guess ? `Not in your list (${e.supplier_guess})` : 'Unknown'}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {e.match_reason && (
          <p className={`text-xs ${lowMatch ? 'text-[#B4472F]' : 'text-[#8A877F]'}`}>
            {lowMatch ? 'Not sure: ' : ''}{e.match_reason}
          </p>
        )}

        {e.agent_documents.length > 0 && (
          <div className="pt-1">
            <button className="flex items-center gap-1 text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer" onClick={() => setOpen(v => !v)}>
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {e.agent_documents.length} attachment{e.agent_documents.length === 1 ? '' : 's'}
            </button>
            {open && (
              <div className="mt-2 space-y-2">
                {e.agent_documents.map(d => <DocumentBlock key={d.id} doc={d} />)}
              </div>
            )}
          </div>
        )}
        {error && <p className="text-xs text-[#B4472F]">{error}</p>}
      </div>
    </div>
  )
}

function DocumentBlock({ doc }: { doc: AgentEmailRow['agent_documents'][number] }) {
  const x = doc.extracted
  return (
    <div className="rounded-lg border border-[#EDE9E1] bg-[#FDFCFA] px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={13} className="text-[#8A877F]" />
        {doc.storage_path ? (
          <a href={`/api/agent/documents/${doc.id}`} target="_blank" rel="noreferrer" className="text-sm text-[#2C2C2A] underline hover:text-[#9A7B4F]">{doc.filename}</a>
        ) : (
          <span className="text-sm text-[#2C2C2A]">{doc.filename}</span>
        )}
        {doc.doc_type && <span className="text-[10px] uppercase tracking-widest text-[#8A877F]">{KIND_LABELS[doc.doc_type] ?? doc.doc_type}</span>}
      </div>
      {doc.read_error && <p className="text-xs text-[#B4472F] mt-1">{doc.read_error}</p>}
      {x && !doc.read_error && (
        <>
          <dl className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
            {x.reference && <Field label="Reference" value={x.reference} />}
            {x.document_date && <Field label="Dated" value={x.document_date} />}
            {x.valid_until && <Field label="Valid until" value={x.valid_until} />}
            {x.lead_time && <Field label="Lead time" value={x.lead_time} />}
            {x.client_or_project_reference && <Field label="For" value={x.client_or_project_reference} />}
            {x.subtotal_excl_vat != null && <Field label="Excl. VAT" value={rand(x.subtotal_excl_vat, x.currency)} />}
            {x.total_incl_vat != null && <Field label="Incl. VAT" value={rand(x.total_incl_vat, x.currency)} />}
          </dl>
          {x.lines.length > 0 && (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-left text-[#8A877F]">
                  <th className="py-1 pr-2 font-medium">Item</th>
                  <th className="py-1 pr-2 font-medium text-right">Qty</th>
                  <th className="py-1 pr-2 font-medium text-right">Unit</th>
                  <th className="py-1 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {x.lines.map((l, i) => (
                  <tr key={i} className="border-t border-[#F0ECE4] text-[#2C2C2A]">
                    <td className="py-1 pr-2">{l.description}{l.code ? <span className="text-[#8A877F]"> · {l.code}</span> : null}</td>
                    <td className="py-1 pr-2 text-right whitespace-nowrap">{l.quantity ?? '—'}{l.unit ? ` ${l.unit}` : ''}</td>
                    <td className="py-1 pr-2 text-right whitespace-nowrap">{rand(l.unit_price, x.currency)}</td>
                    <td className="py-1 text-right whitespace-nowrap">{rand(l.line_total, x.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1.5 text-[11px] text-[#8A877F]">Read from the PDF for reference. Check against the original before using a price.</p>
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#8A877F]">{label}</dt>
      <dd className="text-[#2C2C2A]">{value}</dd>
    </div>
  )
}
