'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

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
}: {
  assignment: Assignment
  token: string
  onSaved: (assignmentId: string, response: Assignment['response']) => void
}) {
  const [expanded, setExpanded] = useState(!assignment.response)
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

  const item = assignment.item
  if (!item) return null

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
            {assignment.response && (
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
          {assignment.response && !expanded && (
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
                style={{ background: '#18181B', color: '#FAFAFA' }}
              >
                {saving ? 'Saving…' : assignment.response ? 'Update Price' : 'Submit Price'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function MessageThread({
  token,
  messages: initialMessages,
  studioName,
}: {
  token: string
  messages: Message[]
  studioName: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #E4E4E7' }}>
        <p className="text-sm font-semibold" style={{ color: '#18181B' }}>Messages with {studioName}</p>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: '#A1A1AA' }}>No messages yet</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_type === 'supplier' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[80%] rounded-xl px-4 py-2.5"
              style={m.sender_type === 'supplier'
                ? { background: '#18181B', color: '#FAFAFA' }
                : { background: '#F4F4F5', color: '#18181B', border: '1px solid #E4E4E7' }
              }
            >
              <p className="text-sm leading-relaxed">{m.body}</p>
              <p className="text-xs mt-1" style={{ color: m.sender_type === 'supplier' ? '#71717A' : '#A1A1AA' }}>
                {m.sender_type === 'supplier' ? 'You' : studioName} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-5 py-3" style={{ borderTop: '1px solid #E4E4E7' }}>
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
            style={{ background: '#18181B', color: '#FAFAFA' }}
          >
            <Send size={14} />
          </button>
        </form>
        {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
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
}: Props) {
  const [items, setItems] = useState(assignments)

  function handleSaved(assignmentId: string, response: Assignment['response']) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, status: 'responded', response } : a)
    )
  }

  const responded = items.filter(a => a.response).length
  const total = items.length
  const allDone = responded === total && total > 0

  return (
    <div className="min-h-screen" style={{ background: '#F4F4F5' }}>
      {/* Header */}
      <div style={{ background: '#18181B' }}>
        <div className="max-w-2xl mx-auto px-6 py-5">
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Progress banner */}
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
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%`, background: '#3F3F46' }}
              />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-3">
          {items.map(assignment => (
            <PriceForm
              key={assignment.id}
              assignment={assignment}
              token={token}
              onSaved={handleSaved}
            />
          ))}
        </div>

        {/* Message thread */}
        <MessageThread token={token} messages={initialMessages} studioName={studioName} />

        <p className="text-center text-xs pb-4" style={{ color: '#A1A1AA' }}>Sent via QuotingHub</p>
      </div>
    </div>
  )
}
