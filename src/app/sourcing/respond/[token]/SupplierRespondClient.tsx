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
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {assignment.response && (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            )}
            <p className="font-semibold text-[#2C2C2A] text-sm truncate">{item.title}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {item.work_type && <span className="text-xs text-[#8A877F]">{item.work_type}</span>}
            {item.item_quantity && <span className="text-xs text-[#8A877F]">Qty: {item.item_quantity}</span>}
            {item.dimensions && <span className="text-xs text-[#8A877F]">{item.dimensions}</span>}
            {item.colour_finish && <span className="text-xs text-[#8A877F]">{item.colour_finish}</span>}
          </div>
          {assignment.response && !expanded && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              R{assignment.response.unit_price.toLocaleString()} submitted
              {assignment.response.lead_time_weeks ? ` · ${assignment.response.lead_time_weeks}w lead` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-[#8A877F] mt-0.5">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#EDE9E1]">
          {item.specifications && (
            <div className="px-5 py-3 bg-[#FAFAF8] border-b border-[#EDE9E1]">
              <p className="text-xs text-[#6B6860] whitespace-pre-wrap leading-relaxed">{item.specifications}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#2C2C2A] mb-1.5">
                  Unit Price (excl. VAT) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A877F]">R</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2C2C2A] mb-1.5">Lead Time (weeks)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={leadTime}
                  onChange={e => setLeadTime(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2C2C2A] mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any conditions, exclusions, or comments…"
                className="w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white resize-none"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg hover:bg-[#3D3D3B] disabled:opacity-50 transition-colors"
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
}: {
  token: string
  messages: Message[]
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
    <div className="bg-white border border-[#EDE9E1] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#EDE9E1]">
        <p className="text-sm font-semibold text-[#2C2C2A]">Messages</p>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-[#C4BFB5] text-center py-4">No messages yet</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_type === 'supplier' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${m.sender_type === 'supplier' ? 'bg-[#2C2C2A] text-[#F5F2EC]' : 'bg-[#F5F2EC] text-[#2C2C2A] border border-[#EDE9E1]'}`}>
              <p className="text-sm leading-relaxed">{m.body}</p>
              <p className={`text-xs mt-1 ${m.sender_type === 'supplier' ? 'text-[#A09A8E]' : 'text-[#C4BFB5]'}`}>
                {m.sender_type === 'supplier' ? 'You' : 'Designer'} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-5 py-3 border-t border-[#EDE9E1]">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="px-3 py-2 bg-[#2C2C2A] text-[#F5F2EC] rounded-lg hover:bg-[#3D3D3B] disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </form>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
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
    <div className="min-h-screen bg-[#F5F2EC]">
      {/* Header */}
      <div className="bg-[#2C2C2A] px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-[#C4A46B] uppercase tracking-widest mb-1">Pricing Request</p>
          <p className="text-lg font-semibold text-[#F5F2EC]">{sessionTitle}</p>
          {projectName && <p className="text-sm text-[#A09A8E] mt-0.5">{projectName}</p>}
          <p className="text-xs text-[#8A877F] mt-2">From {studioName} · To {supplierName}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress banner */}
        {allDone ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">All prices submitted</p>
              <p className="text-xs text-emerald-600">You can still update individual prices or send a message.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#EDE9E1] rounded-xl px-5 py-3.5 flex items-center justify-between">
            <p className="text-sm text-[#2C2C2A]">
              <span className="font-semibold">{responded} of {total}</span> item{total !== 1 ? 's' : ''} priced
            </p>
            <div className="flex-1 mx-6 bg-[#EDE9E1] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#C4A46B] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%` }}
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
        <MessageThread token={token} messages={initialMessages} />

        <p className="text-center text-xs text-[#C4BFB5] pb-4">Sent via QuotingHub</p>
      </div>
    </div>
  )
}
