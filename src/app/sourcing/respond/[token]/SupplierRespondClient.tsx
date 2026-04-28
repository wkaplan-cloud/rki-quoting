'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, CheckCircle2, ChevronDown, ChevronUp, Lock, RefreshCw, Upload, FileText, X, AlertTriangle, Ban } from 'lucide-react'

interface Assignment {
  id: string
  status: string
  responded_at: string | null
  item: {
    id: string
    title: string
    work_type: string | null
    specifications: string | null
    item_quantity: number | null
    dimensions: string | null
    colour_finish: string | null
  } | null
  response: {
    id: string
    unit_price: number
    fabric_quantity: number | null
    fabric_unit: string | null
    lead_time_weeks: number | null
    valid_until: string | null
    notes: string | null
  } | null
}

interface Message {
  id: string
  sender_type: 'designer' | 'supplier'
  body: string
  created_at: string
}

interface Props {
  token: string
  sessionSupplierId: string
  supplierName: string
  sessionTitle: string
  projectName: string | null
  studioName: string
  assignments: Assignment[]
  initialMessages: Message[]
  showBackLink?: boolean
}

const INPUT = {
  background: '#27272A',
  border: '1px solid #3F3F46',
  color: '#FAFAFA',
}

function PriceForm({
  assignment,
  token,
  onSaved,
  onDeclined,
}: {
  assignment: Assignment
  token: string
  onSaved: (assignmentId: string, response: Assignment['response']) => void
  onDeclined: (assignmentId: string) => void
}) {
  const [expanded, setExpanded] = useState(!assignment.response)
  const [cantSupply, setCantSupply] = useState(assignment.status === 'supplier_declined')
  const [cantReason, setCantReason] = useState('')
  const [unitPrice, setUnitPrice] = useState(assignment.response?.unit_price?.toString() ?? '')
  const [leadTime, setLeadTime] = useState(assignment.response?.lead_time_weeks?.toString() ?? '')
  const [notes, setNotes] = useState(assignment.response?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitPrice || isNaN(Number(unitPrice))) {
      setError('Please enter a valid unit price')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          unit_price: Number(unitPrice),
          lead_time_weeks: leadTime ? Number(leadTime) : null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onSaved(assignment.id, json.data)
      setExpanded(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCantSupply() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id, reason: cantReason.trim() || undefined }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onDeclined(assignment.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const item = assignment.item
  if (!item) return null

  // Locked red tile — supplier can't supply this item
  if (assignment.status === 'supplier_declined') {
    const reason = assignment.response?.notes?.replace("[CAN'T SUPPLY] ", '')
    return (
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
        <Ban size={16} className="text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#18181B' }}>{item.title}</p>
          {reason ? (
            <p className="text-xs text-red-600 mt-0.5">{reason}</p>
          ) : (
            <p className="text-xs text-red-400 mt-0.5">Marked as can&apos;t supply</p>
          )}
        </div>
        <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full shrink-0">Can&apos;t supply</span>
      </div>
    )
  }

  // Locked green tile — designer accepted this price
  if (assignment.status === 'accepted') {
    return (
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#F0FDF4', border: '1px solid #A7F3D0' }}>
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#18181B' }}>{item.title}</p>
          <p className="text-sm text-emerald-700 font-medium mt-0.5">
            R{assignment.response?.unit_price.toLocaleString()} accepted
            {assignment.response?.lead_time_weeks ? ` · ${assignment.response.lead_time_weeks}w lead` : ''}
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full shrink-0">Accepted</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: expanded ? '#FAFAFA' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#FAFAFA' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {assignment.response && !cantSupply && (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            )}
            <p className="font-semibold text-sm truncate" style={{ color: '#18181B' }}>{item.title}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {item.work_type && <span className="text-xs" style={{ color: '#71717A' }}>{item.work_type}</span>}
            {item.item_quantity && <span className="text-xs" style={{ color: '#71717A' }}>Qty: {item.item_quantity}</span>}
            {item.dimensions && <span className="text-xs" style={{ color: '#71717A' }}>{item.dimensions}</span>}
            {item.colour_finish && <span className="text-xs" style={{ color: '#71717A' }}>{item.colour_finish}</span>}
          </div>
          {assignment.response && !expanded && !cantSupply && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              R{assignment.response.unit_price.toLocaleString()} submitted
              {assignment.response.lead_time_weeks ? ` · ${assignment.response.lead_time_weeks}w lead` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 mt-0.5" style={{ color: '#A1A1AA' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #E4E4E7' }}>
          {item.specifications && (
            <div className="px-5 py-3" style={{ background: '#FAFAFA', borderBottom: '1px solid #E4E4E7' }}>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#52525B' }}>{item.specifications}</p>
            </div>
          )}

          {/* Can't supply toggle */}
          <div className="px-5 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={() => setCantSupply(v => !v)}
                className={`w-9 h-5 rounded-full flex items-center transition-colors ${cantSupply ? 'bg-red-400' : 'bg-[#E4E4E7]'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${cantSupply ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-medium" style={{ color: cantSupply ? '#EF4444' : '#71717A' }}>
                Can&apos;t supply this item
              </span>
            </label>
          </div>

          {cantSupply ? (
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>
                  Reason (optional)
                </label>
                <textarea
                  value={cantReason}
                  onChange={e => setCantReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Out of stock, discontinued, outside our scope…"
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                  style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setCantSupply(false)}
                  className="px-4 py-2 text-sm rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: '#71717A', border: '1px solid #E4E4E7' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleCantSupply} disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}>
                  {saving ? 'Saving…' : 'Confirm can\'t supply'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>
                    Unit Price (excl. VAT) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#A1A1AA' }}>R</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={e => setUnitPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-7 pr-3 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Lead Time (weeks)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={leadTime}
                    onChange={e => setLeadTime(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                    style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any conditions, exclusions, or comments…"
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                  style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: '#34495E', color: '#FFFFFF' }}
                >
                  {saving ? 'Saving…' : assignment.response ? 'Update Price' : 'Submit Price'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function QuoteUpload({ token, locked }: { token: string; locked?: boolean }) {
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/sourcing/respond/${token}/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUploads(prev => [...prev, { name: file.name, url: json.url }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #E4E4E7' }}>
        <p className="text-sm font-semibold" style={{ color: '#18181B' }}>Upload Quote</p>
        <p className="text-xs mt-0.5" style={{ color: '#A1A1AA' }}>Attach your formal quote document (PDF, Excel, etc.)</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {uploads.map((u, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: '#F4F4F5' }}>
            <FileText size={14} style={{ color: '#71717A' }} className="shrink-0" />
            <a href={u.url} target="_blank" rel="noopener noreferrer"
              className="text-sm flex-1 truncate hover:underline" style={{ color: '#18181B' }}>
              {u.name}
            </a>
            <button onClick={() => setUploads(prev => prev.filter((_, j) => j !== i))}
              className="shrink-0 transition-opacity hover:opacity-60" style={{ color: '#A1A1AA' }}>
              <X size={13} />
            </button>
          </div>
        ))}
        {locked ? (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed select-none"
            style={{ background: '#F4F4F5', color: '#71717A', border: '1px dashed #D4D4D8' }}>
            <Upload size={14} />
            Upload locked — pricing accepted
          </div>
        ) : (
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-opacity ${uploading ? 'opacity-50 pointer-events-none' : 'hover:opacity-80'}`}
            style={{ background: '#F4F4F5', color: '#71717A', border: '1px dashed #D4D4D8' }}>
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Choose file'}
            <input type="file" className="hidden" onChange={handleFile} disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg" />
          </label>
        )}
        {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    </div>
  )
}

function MessageThread({
  token,
  messages: initialMessages,
  studioName,
  locked,
}: {
  token: string
  messages: Message[]
  studioName: string
  locked?: boolean
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/messages`)
      const json = await res.json()
      if (json.data) setMessages(json.data)
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessages(prev => [...prev, json.data])
      setBody('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E4E4E7' }}>
        <p className="text-sm font-semibold" style={{ color: '#18181B' }}>Messages with {studioName}</p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh messages"
          className="p-1 transition-opacity disabled:opacity-40"
          style={{ color: '#A1A1AA' }}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#A1A1AA' }}>No messages yet</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_type === 'supplier' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[75%] rounded-2xl px-4 py-2.5"
              style={m.sender_type === 'supplier'
                ? { background: '#7C3AED', color: '#FFFFFF', borderBottomRightRadius: 4 }
                : { background: '#0D9488', color: '#FFFFFF', borderBottomLeftRadius: 4 }
              }
            >
              <p className="text-sm leading-relaxed">{m.body}</p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {m.sender_type === 'supplier' ? 'You' : studioName} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-5 py-3" style={{ borderTop: '1px solid #E4E4E7' }}>
        {locked ? (
          <div className="flex items-center gap-2 py-1" style={{ color: '#71717A' }}>
            <Lock size={13} />
            <p className="text-xs">Pricing accepted — thread closed</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="px-3 py-2 rounded-lg transition-opacity disabled:opacity-40"
                style={{ background: '#34495E', color: '#FFFFFF' }}
              >
                <Send size={14} />
              </button>
            </form>
            {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export function SupplierRespondClient({
  token,
  sessionSupplierId,
  supplierName,
  sessionTitle,
  projectName,
  studioName,
  assignments,
  initialMessages,
  showBackLink = false,
}: Props) {
  const [items, setItems] = useState(assignments)
  const [declining, setDeclining] = useState(false)
  const [fullyDeclined, setFullyDeclined] = useState(false)

  const allAccepted = items.length > 0 && items.every(a => a.status === 'accepted')

  function handleSaved(assignmentId: string, response: Assignment['response']) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, status: 'responded', response } : a)
    )
  }

  function handleDeclined(assignmentId: string) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, status: 'supplier_declined' } : a)
    )
  }

  async function handleDeclineAll() {
    if (!window.confirm('Decline this entire price request? The designer will be notified.')) return
    setDeclining(true)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setFullyDeclined(true)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeclining(false)
    }
  }

  const responded = items.filter(a => a.response && a.status !== 'supplier_declined').length
  const total = items.length
  const allDone = responded === total && total > 0

  if (fullyDeclined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F4F5' }}>
        <div className="text-center px-6 py-12">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#FFF1F2' }}>
            <Ban size={22} className="text-red-400" />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: '#18181B' }}>Request declined</p>
          <p className="text-sm" style={{ color: '#71717A' }}>The design studio has been notified.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F4F5' }}>
      {/* Header — only shown for standalone (unauthenticated) token access */}
      {showBackLink && (
        <div style={{ background: '#27272A' }}>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="QuotingHub" className="h-6 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.6)' }} />
              <a
                href="/supplier-portal/dashboard"
                className="text-xs font-medium transition-opacity hover:opacity-60"
                style={{ color: '#71717A' }}
              >
                ← Back to portal
              </a>
            </div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#71717A' }}>Pricing Request</p>
            <p className="text-lg font-semibold" style={{ color: '#FAFAFA' }}>{sessionTitle}</p>
            {projectName && <p className="text-sm mt-0.5" style={{ color: '#A1A1AA' }}>{projectName}</p>}
            <p className="text-xs mt-2" style={{ color: '#52525B' }}>From {studioName} · To {supplierName}</p>
          </div>
        </div>
      )}

      {/* Session info — shown in portal context instead of dark header */}
      {!showBackLink && (
        <div className="px-6 pt-6">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#A1A1AA' }}>Pricing Request</p>
          <h1 className="text-lg font-semibold" style={{ color: '#18181B' }}>{sessionTitle}</h1>
          {projectName && <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>{projectName}</p>}
          <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>From {studioName} · To {supplierName}</p>
        </div>
      )}

      {showBackLink ? (
        /* ── Standalone / email view — narrow single column ── */
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {allDone ? (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div>
                {allAccepted ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-800">Pricing accepted</p>
                    <p className="text-xs text-emerald-600">The studio has accepted your quotes. No further action needed.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-emerald-800">All prices submitted</p>
                    <p className="text-xs text-emerald-600">Awaiting review from the studio.</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3.5 rounded-xl flex items-center justify-between" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
              <p className="text-sm" style={{ color: '#18181B' }}>
                <span className="font-semibold">{responded} of {total}</span> item{total !== 1 ? 's' : ''} priced
              </p>
              <div className="flex-1 mx-6 rounded-full h-1.5 overflow-hidden" style={{ background: '#E4E4E7' }}>
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%`, background: '#34495E' }} />
              </div>
            </div>
          )}
          <div className="space-y-3">
            {items.map(assignment => (
              <PriceForm key={assignment.id} assignment={assignment} token={token} onSaved={handleSaved} onDeclined={handleDeclined} />
            ))}
          </div>
          <QuoteUpload token={token} locked={allAccepted} />
          <MessageThread token={token} messages={initialMessages} studioName={studioName} locked={allAccepted} />
          {!allAccepted && (
            <div className="pt-2 border-t border-[#E4E4E7]">
              <button type="button" onClick={handleDeclineAll} disabled={declining}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40 mx-auto"
                style={{ color: '#EF4444' }}>
                <AlertTriangle size={13} />
                {declining ? 'Declining…' : 'Decline entire request'}
              </button>
            </div>
          )}
          <p className="text-center text-xs pb-4" style={{ color: '#A1A1AA' }}>Sent via QuotingHub</p>
        </div>
      ) : (
        /* ── Portal view — full width 2-column ── */
        <div className="px-4 py-6">
          <div className="mb-4">
            {allDone ? (
              <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">All prices submitted</p>
                  <p className="text-xs text-emerald-600">You can still update individual prices or send a message.</p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3.5 rounded-xl flex items-center justify-between" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
                <p className="text-sm" style={{ color: '#18181B' }}>
                  <span className="font-semibold">{responded} of {total}</span> item{total !== 1 ? 's' : ''} priced
                </p>
                <div className="flex-1 mx-6 rounded-full h-1.5 overflow-hidden" style={{ background: '#E4E4E7' }}>
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%`, background: '#34495E' }} />
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
            <div className="space-y-3">
              {items.map(assignment => (
                <PriceForm key={assignment.id} assignment={assignment} token={token} onSaved={handleSaved} onDeclined={handleDeclined} />
              ))}
            </div>
            <div className="space-y-4">
              <QuoteUpload token={token} locked={allAccepted} />
              <MessageThread token={token} messages={initialMessages} studioName={studioName} locked={allAccepted} />
              {!allAccepted && (
                <div className="pt-2 border-t border-[#E4E4E7]">
                  <button type="button" onClick={handleDeclineAll} disabled={declining}
                    className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40 mx-auto"
                    style={{ color: '#EF4444' }}>
                    <AlertTriangle size={13} />
                    {declining ? 'Declining…' : 'Decline entire request'}
                  </button>
                </div>
              )}
              <p className="text-center text-xs pb-2" style={{ color: '#A1A1AA' }}>Sent via QuotingHub</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
