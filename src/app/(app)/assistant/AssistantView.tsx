'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Copy, Check, AlertTriangle, ChevronDown, ChevronRight, RotateCcw, Inbox } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Combobox } from '@/components/ui/Combobox'
import type { ChaseList } from '@/lib/agent/chase-list'

export interface MailboxInfo {
  agent_name: string
  email: string
  last_received_at: string | null
  last_error: string | null
  drive_folder_id: string | null
  credit_out_at: string | null
}

export interface Costs {
  thisMonth: number
  lastMonth: number
  perEmail: number | null
  emailsRead: number
  usdZar: number
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
  sent_to: string[]
  sent_cc: string[]
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
    drive_link: string | null
    drive_parent_id: string | null
    drive_error: string | null
  }[]
}

interface Option { id: string; label: string }
interface ClientOption extends Option { name: string }

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

// Not a project id: the dropdown row that opens the new-project form.
const NEW_PROJECT = '__new'

const selectClass = 'w-full text-sm px-2.5 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] cursor-pointer'

export function AssistantView({ mailbox, driveAccount, costs, chase, emails, projects, clients, suppliers }: {
  mailbox: MailboxInfo | null
  driveAccount: string | null
  costs: Costs
  chase: ChaseList
  emails: AgentEmailRow[]
  projects: Option[]
  clients: ClientOption[]
  suppliers: Option[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'needs' | 'all'>('needs')
  const [showSettings, setShowSettings] = useState(false)

  const name = mailbox?.agent_name ?? 'Assistant'
  const needs = useMemo(() => emails.filter(e => e.status !== 'done'), [emails])
  const shown = tab === 'needs' ? needs : emails

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={name}
        subtitle={mailbox ? 'Files the supplier mail forwarded to her, and flags what needs doing' : 'Set up to start'}
        count={mailbox ? needs.length : undefined}
      />

      <div className="p-4 md:p-8 space-y-4 max-w-5xl">
        {mailbox && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8A877F]">
            <span>Last email {mailbox.last_received_at ? when(mailbox.last_received_at) : 'none yet'}</span>
            <button className="underline hover:text-[#2C2C2A] cursor-pointer" onClick={() => setShowSettings(v => !v)}>
              {showSettings ? 'Hide setup' : 'Address & setup'}
            </button>
          </div>
        )}

        {mailbox?.credit_out_at && <CreditOut since={mailbox.credit_out_at} name={name} onDone={() => router.refresh()} />}

        {mailbox && <CostBox costs={costs} />}

        {mailbox && <ChaseBox chase={chase} />}

        {mailbox?.last_error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#E8C4B8] bg-[#FBEFEA] px-4 py-3 text-sm text-[#8A3A22]">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>The last email could not be taken in: {mailbox.last_error}</span>
          </div>
        )}

        {!mailbox && <SetupForm onDone={() => router.refresh()} />}
        {mailbox && showSettings && <AddressCard mailbox={mailbox} driveAccount={driveAccount} onSaved={() => router.refresh()} />}

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
                {tab === 'needs' ? 'Nothing waiting. Everything is filed.' : `Nothing in ${name}'s inbox yet. Forward a supplier email to ${mailbox.email}.`}
              </div>
            ) : (
              <div className="space-y-3">
                {shown.map(e => <EmailCard key={e.id} email={e} projects={projects} clients={clients} suppliers={suppliers} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [agentName, setAgentName] = useState('Mia')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Could not set up')
      else onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#D8D3C8] bg-white p-5 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-[#1A1A18]">Set up the studio assistant</h2>
        <p className="mt-1 text-sm text-[#4A4A47]">She gets her own email address. Forward supplier mail to it and she files each email and PDF to the right project.</p>
      </div>
      <div className="max-w-xs">
        <Input label="Name" value={agentName} onChange={e => setAgentName(e.target.value)} />
      </div>
      {error && <p className="text-sm text-[#B4472F]">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={create} disabled={saving}>{saving ? 'Setting up…' : 'Create her address'}</Button>
      </div>
    </div>
  )
}

function AddressCard({ mailbox, driveAccount, onSaved }: { mailbox: MailboxInfo; driveAccount: string | null; onSaved: () => void }) {
  const [agentName, setAgentName] = useState(mailbox.agent_name)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy() {
    await navigator.clipboard.writeText(mailbox.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function rename() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/mailbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName }),
      })
      if (!res.ok) setError((await res.json()).error ?? 'Could not save')
      else onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#D8D3C8] bg-white p-5 space-y-4">
      <div>
        <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">{mailbox.agent_name}&rsquo;s address</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="text-sm text-[#2C2C2A] bg-[#F5F2EC] border border-[#EDE9E1] rounded px-2.5 py-1.5 break-all">{mailbox.email}</code>
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-[#4A4A47]">
        Supplier mail reaches {mailbox.agent_name} automatically through the studio&rsquo;s Google Workspace rule. To send her one by hand, forward it to the address above.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-60">
          <Input label="Name" value={agentName} onChange={e => setAgentName(e.target.value)} />
        </div>
        <Button size="sm" variant="secondary" onClick={rename} disabled={saving || agentName.trim() === mailbox.agent_name}>
          {saving ? 'Saving…' : 'Rename'}
        </Button>
      </div>
      {error && <p className="text-sm text-[#B4472F]">{error}</p>}
      {driveAccount && <DriveSettings mailbox={mailbox} driveAccount={driveAccount} onSaved={onSaved} />}
    </div>
  )
}

function DriveSettings({ mailbox, driveAccount, onSaved }: { mailbox: MailboxInfo; driveAccount: string; onSaved: () => void }) {
  const [folder, setFolder] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/drive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Could not connect the folder')
      else { setSaved(data.name); setFolder(''); onSaved() }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-[#EDE9E1] pt-4 space-y-2">
      <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Google Drive</span>
      <p className="text-xs text-[#4A4A47]">
        {mailbox.drive_folder_id || saved
          ? `Connected${saved ? ` to “${saved}”` : ''}. PDFs filed to a project are saved in that project’s subfolder.`
          : `Make a folder in a Shared Drive, share it with ${driveAccount} as Content manager, then paste its link here.`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[260px]">
          <Input label={mailbox.drive_folder_id ? 'Change folder link' : 'Folder link'} value={folder} onChange={e => setFolder(e.target.value)} />
        </div>
        <Button size="sm" variant="secondary" onClick={save} disabled={saving || !folder.trim()}>
          {saving ? 'Checking…' : 'Connect'}
        </Button>
      </div>
      {error && <p className="text-sm text-[#B4472F]">{error}</p>}
    </div>
  )
}

function OriginalEmail({ emailId }: { emailId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setOpen(!open)
    if (open || text !== null || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent/emails/${emailId}`)
      const data = await res.json()
      if (res.ok) setText(data.text)
      else setError(data.error ?? 'Could not load the email')
    } catch {
      setError('Could not load the email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pt-1">
      <button className="flex items-center gap-1 text-xs text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer" aria-expanded={open} onClick={toggle}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide email' : 'Show email'}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-[#EDE9E1] bg-[#FAF8F4] px-3 py-2 text-sm text-[#2C2C2A]">
          {loading && <p className="text-xs text-[#8A877F]">Loading…</p>}
          {error && <p className="text-xs text-[#B4472F]">{error}</p>}
          {text === '' && <p className="text-xs text-[#8A877F]">This email has no text.</p>}
          {text && <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words">{text}</div>}
        </div>
      )}
    </div>
  )
}

function EmailCard({ email: e, projects, clients, suppliers }: { email: AgentEmailRow; projects: Option[]; clients: ClientOption[]; suppliers: Option[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  // A refresh can take seconds; until it lands the dropdowns still show the old filing.
  const [refreshing, startRefresh] = useTransition()

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/agent/emails/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) setError((await res.json()).error ?? 'Could not save')
    setBusy(false)
    startRefresh(() => router.refresh())
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
  const driveFolderId = e.agent_documents.find(d => d.drive_link && d.drive_parent_id)?.drive_parent_id

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
          {e.sent_to.length > 0 && <p className="text-xs text-[#8A877F] mt-0.5 break-words">To: {e.sent_to.join(', ')}</p>}
          {e.sent_cc.length > 0 && <p className="text-xs text-[#8A877F] break-words">Cc: {e.sent_cc.join(', ')}</p>}
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
          <p className="text-sm text-[#7A5F35] bg-[#FBF5EA] border border-[#EADBC0] rounded-md px-3 py-1.5 break-words">
            <ActionText text={e.action_needed} />
          </p>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Project{busy || refreshing ? ' · saving…' : ''}</span>
            <select className={selectClass} value={e.project_id ?? ''} disabled={busy || refreshing} onChange={ev => {
              if (ev.target.value === NEW_PROJECT) setAddingProject(true)
              else patch({ project_id: ev.target.value || null })
            }}>
              <option value="">Not filed to a project</option>
              <option value={NEW_PROJECT}>+ New project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Supplier</span>
            <select className={selectClass} value={e.supplier_id ?? ''} disabled={busy || refreshing} onChange={ev => patch({ supplier_id: ev.target.value || null })}>
              <option value="">{e.supplier_guess ? `Not in your list (${e.supplier_guess})` : 'Unknown'}</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {addingProject && (
          <NewProjectForm
            suggestion={e.agent_documents.map(d => d.extracted?.client_or_project_reference).find(Boolean) ?? ''}
            clients={clients}
            onCancel={() => setAddingProject(false)}
            onCreated={async id => { setAddingProject(false); await patch({ project_id: id }) }}
          />
        )}
        {e.match_reason && (
          <p className={`text-xs ${lowMatch ? 'text-[#B4472F]' : 'text-[#8A877F]'}`}>
            {lowMatch ? 'Not sure: ' : ''}{e.match_reason}
          </p>
        )}

        <OriginalEmail emailId={e.id} />

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
        {driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-[#7E6036] underline hover:text-[#2C2C2A]"
          >
            View in folder
          </a>
        )}
        {error && <p className="text-xs text-[#B4472F]">{error}</p>}
      </div>
    </div>
  )
}

function ChaseBox({ chase }: { chase: ChaseList }) {
  const count = chase.quotes.length + chase.rfqs.length
  if (count === 0) return null

  const expiry = (days: number) =>
    days < 0 ? `Expired ${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`

  return (
    <div className="rounded-xl border border-[#D8D3C8] bg-white">
      <h2 className="px-4 pt-3 pb-1 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">To chase ({count})</h2>
      <ul className="divide-y divide-[#EDE9E1]">
        {chase.quotes.map(q => (
          <ChaseRow
            key={q.id}
            kind="quote"
            id={q.id}
            title={[q.supplier ?? 'Quote', q.reference].filter(Boolean).join(' · ')}
            detail={[expiry(q.daysLeft), q.project ?? 'Not filed to a project'].join(' · ')}
            urgent={q.daysLeft <= 2}
            href={`/api/agent/documents/${q.id}`}
          />
        ))}
        {chase.rfqs.map(r => (
          <ChaseRow
            key={r.id}
            kind="rfq"
            id={r.id}
            title={r.supplier}
            detail={[
              `No reply to RFQ after ${r.daysWaiting} days`,
              r.opened ? 'Opened the link' : 'Not opened',
              r.linkExpired ? 'Link has expired' : null,
              r.board,
            ].filter(Boolean).join(' · ')}
            urgent={r.linkExpired}
          />
        ))}
      </ul>
    </div>
  )
}

function ChaseRow({ kind, id, title, detail, urgent, href }: {
  kind: 'quote' | 'rfq'
  id: string
  title: string
  detail: string
  urgent: boolean
  href?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function done() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/agent/chase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id }) })
    if (!res.ok) {
      setError((await res.json()).error ?? 'Could not save')
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <li className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex-1 min-w-[220px]">
        {href
          ? <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#2C2C2A] underline hover:text-[#9A7B4F]">{title}</a>
          : <p className="text-sm font-medium text-[#2C2C2A]">{title}</p>}
        <p className={`text-xs ${urgent ? 'text-[#B4472F]' : 'text-[#8A877F]'}`}>{detail}</p>
        {error && <p className="text-xs text-[#B4472F]">{error}</p>}
      </div>
      <Button size="sm" variant="secondary" onClick={done} disabled={busy}><Check size={12} /> {busy ? 'Saving…' : 'Dealt with'}</Button>
    </li>
  )
}

function NewProjectForm({ suggestion, clients, onCancel, onCreated }: {
  suggestion: string
  clients: ClientOption[]
  onCancel: () => void
  onCreated: (id: string) => Promise<void>
}) {
  // What she read on the document can be a client, a project or both, so a
  // known client is picked for them and the rest is theirs to check.
  const known = suggestion ? clients.find(c => suggestion.toLowerCase().includes(c.name.toLowerCase())) : undefined
  const [projectName, setProjectName] = useState(suggestion)
  const [clientId, setClientId] = useState(known?.id ?? '')
  const [clientName, setClientName] = useState(known?.label ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/agent/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_name: projectName, client_id: clientId || null, client_name: clientName }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not create the project')
      setSaving(false)
      return
    }
    await onCreated(data.id)
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-[#D8D3C8] bg-[#FAF8F4] p-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Project name" value={projectName} onChange={ev => setProjectName(ev.target.value)} required autoFocus />
        <Combobox
          label="Client"
          options={clients}
          value={clientId}
          inputValue={clientName}
          onChange={(id, label) => { setClientId(id); setClientName(label) }}
          onCreate={name => { setClientId(''); setClientName(name) }}
        />
      </div>
      <p className="text-xs text-[#8A877F]">
        {clientName.trim() && !clientId ? `“${clientName.trim()}” will be added as a client if they aren’t one yet. ` : ''}
        The project gets the next project number.
      </p>
      {error && <p className="text-xs text-[#B4472F]">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Creating…' : 'Create and file here'}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
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
      {doc.drive_link && (
        <a href={doc.drive_link} target="_blank" rel="noreferrer" className="inline-block mt-1 text-xs text-[#7E6036] underline hover:text-[#2C2C2A]">In Drive</a>
      )}
      {doc.drive_error && <p className="text-xs text-[#B4472F] mt-1">Not saved to Drive: {doc.drive_error}</p>}
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

// Action text is written by the model from outside mail, so it is plain text.
// The one exception is Google's forwarding-confirmation link, made clickable
// because the studio has to open it; no other link ever is.
const GOOGLE_FORWARDING_LINK = /(https:\/\/mail(?:-settings)?\.google\.com\/mail\/vf-\S+)/

function ActionText({ text }: { text: string }) {
  const [before, link, after] = text.split(GOOGLE_FORWARDING_LINK)
  if (!link) return <>{text}</>
  return (
    <>
      {before}
      <a href={link} target="_blank" rel="noreferrer" className="underline font-medium hover:text-[#2C2C2A]">Confirm forwarding in Gmail</a>
      {after}
    </>
  )
}

const zar = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function CostBox({ costs }: { costs: Costs }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-[#D8D3C8] bg-white px-5 py-3">
      <Stat label="This month" value={zar(costs.thisMonth)} note={`${costs.emailsRead} email${costs.emailsRead === 1 ? '' : 's'} read`} />
      <Stat label="Last month" value={zar(costs.lastMonth)} />
      <Stat label="Per email" value={costs.perEmail == null ? '—' : zar(costs.perEmail)} note="average this month" />
      <p className="basis-full text-[11px] text-[#8A877F]">
        Estimate of Claude usage at R{costs.usdZar.toFixed(2)} to the dollar. Your actual bill is at console.anthropic.com.
      </p>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">{label}</div>
      <div className="font-serif text-lg text-[#1A1A18]">{value}</div>
      {note && <div className="text-[11px] text-[#8A877F]">{note}</div>}
    </div>
  )
}

function CreditOut({ since, name, onDone }: { since: string; name: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function readAll() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/agent/retry-failed', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setResult(data.error ?? 'Could not read them')
      else setResult(`${data.filed} read${data.failed ? `, ${data.failed} still failing` : ''}${data.left ? ` — ${data.left} left, press again` : ''}.`)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#E8C4B8] bg-[#FBEFEA] px-5 py-4 space-y-2">
      <div className="flex items-start gap-2 text-sm text-[#8A3A22]">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">{name} has run out of Claude credit (since {when(since)}).</p>
          <p>Supplier emails are still arriving and being saved, but she can&rsquo;t read them until the account is topped up.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <a
          href="https://console.anthropic.com/settings/billing"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium rounded px-3 py-1.5 text-xs bg-[#2C2C2A] text-[#F5F2EC] hover:bg-[#9A7B4F] transition-colors"
        >
          Top up credit
        </a>
        <Button size="sm" variant="secondary" onClick={readAll} disabled={busy}>
          <RotateCcw size={12} /> {busy ? 'Reading…' : 'Read all again'}
        </Button>
        {result && <span className="text-xs text-[#8A3A22]">{result}</span>}
      </div>
    </div>
  )
}
