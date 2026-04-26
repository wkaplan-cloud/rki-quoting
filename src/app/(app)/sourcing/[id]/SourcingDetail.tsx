'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Send, CheckCircle2, Archive, Loader2,
  ChevronDown, ChevronUp, MessageSquare, X, Check
} from 'lucide-react'

// ---- Types ----
interface SessionItem {
  id: string
  title: string
  work_type: string | null
  specifications: string | null
  item_quantity: number | null
  dimensions: string | null
  colour_finish: string | null
  status: string
  sort_order: number
}

interface Response {
  id: string
  unit_price: number
  lead_time_weeks: number | null
  notes: string | null
}

interface Assignment {
  id: string
  item_id: string
  status: string
  responded_at: string | null
  accepted_at: string | null
  response: Response | null
}

interface SessionSupplier {
  id: string
  supplier_id: string | null
  supplier_name: string
  email: string
  token: string
  status: string
  sent_at: string | null
  assignments: Assignment[]
}

interface Session {
  id: string
  title: string
  status: string
  archived: boolean
  project_id: string | null
  project_name: string | null
}

interface Props {
  session: Session
  initialItems: SessionItem[]
  initialSuppliers: SessionSupplier[]
  allSuppliers: { id: string; supplier_name: string; email: string | null }[]
  projects: { id: string; project_number: string | null; project_name: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]',
  accepted:    'bg-emerald-50 text-emerald-600 border border-emerald-200',
  draft:       'bg-[#F5F2EC] text-[#8A877F]',
  sent:        'bg-blue-50 text-blue-600',
  in_progress: 'bg-amber-50 text-amber-600',
  completed:   'bg-emerald-50 text-emerald-600',
  pending:     'bg-[#F5F2EC] text-[#8A877F]',
  viewed:      'bg-sky-50 text-sky-600',
  responded:   'bg-amber-50 text-amber-600',
}

// ---- Add Item Form ----
function AddItemForm({ sessionId, onAdded }: { sessionId: string; onAdded: (item: SessionItem) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState('')
  const [qty, setQty] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [colourFinish, setColourFinish] = useState('')
  const [specs, setSpecs] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          work_type: workType.trim() || null,
          item_quantity: qty ? Number(qty) : null,
          dimensions: dimensions.trim() || null,
          colour_finish: colourFinish.trim() || null,
          specifications: specs.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded(json.data)
      setTitle(''); setWorkType(''); setQty(''); setDimensions(''); setColourFinish(''); setSpecs('')
      setOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors py-1"
      >
        <Plus size={14} /> Add Item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[#C4A46B] rounded-xl p-4 space-y-3 bg-[#FEFDF9]">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Item name *"
            required
            className="w-full px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
          />
        </div>
        <input value={workType} onChange={e => setWorkType(e.target.value)} placeholder="Category (e.g. Upholstery)" className="px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white" />
        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" className="px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white" />
        <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions" className="px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white" />
        <input value={colourFinish} onChange={e => setColourFinish(e.target.value)} placeholder="Colour / Finish" className="px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white" />
        <div className="col-span-2">
          <textarea value={specs} onChange={e => setSpecs(e.target.value)} rows={2} placeholder="Specifications / Notes" className="w-full px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
        <button type="submit" disabled={saving || !title.trim()} className="px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// ---- Add Supplier Form ----
function AddSupplierForm({
  sessionId,
  allSuppliers,
  existingEmails,
  onAdded,
}: {
  sessionId: string
  allSuppliers: { id: string; supplier_name: string; email: string | null }[]
  existingEmails: string[]
  onAdded: (ss: SessionSupplier) => void
}) {
  const [open, setOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [email, setEmail] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function handleSelectSupplier(s: { id: string; supplier_name: string; email: string | null }) {
    setSupplierName(s.supplier_name)
    setEmail(s.email ?? '')
    setSupplierId(s.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierName.trim() || !email.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_name: supplierName.trim(), email: email.trim(), supplier_id: supplierId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded({ ...json.data, assignments: [] })
      setSupplierName(''); setEmail(''); setSupplierId(null); setOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors py-1">
        <Plus size={14} /> Add Supplier
      </button>
    )
  }

  const filtered = allSuppliers.filter(s => s.supplier_name.toLowerCase().includes(supplierName.toLowerCase()) && !existingEmails.includes(s.email ?? ''))

  return (
    <form onSubmit={handleSubmit} className="border border-[#C4A46B] rounded-xl p-4 space-y-3 bg-[#FEFDF9]">
      <div className="relative">
        <input
          autoFocus
          value={supplierName}
          onChange={e => { setSupplierName(e.target.value); setSupplierId(null) }}
          placeholder="Supplier / manufacturer name *"
          required
          className="w-full px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
        />
        {supplierName.length > 1 && filtered.length > 0 && !supplierId && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#EDE9E1] rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
            {filtered.slice(0, 6).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSupplier(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors"
              >
                <span className="font-medium text-[#2C2C2A]">{s.supplier_name}</span>
                {s.email && <span className="text-[#8A877F] ml-2">{s.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email address *"
        required
        className="w-full px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
        <button type="submit" disabled={saving || !supplierName.trim() || !email.trim()} className="px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Supplier'}
        </button>
      </div>
    </form>
  )
}

// ---- Supplier Card ----
function SupplierCard({
  ss,
  items,
  sessionId,
  sessionStatus,
  onAssignToggle,
  onAccept,
  onPushToProject,
  onRemove,
  projects,
}: {
  ss: SessionSupplier
  items: SessionItem[]
  sessionId: string
  sessionStatus: string
  onAssignToggle: (ssId: string, itemId: string, assigned: boolean) => void
  onAccept: (itemId: string, assignmentId: string) => void
  onPushToProject: (itemId: string, projectId: string, markup: number) => void
  onRemove: (ssId: string) => void
  projects: Props['projects']
}) {
  const [expanded, setExpanded] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [messages, setMessages] = useState<{ id: string; sender_type: string; body: string; created_at: string }[]>([])
  const [msgBody, setMsgBody] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pushing, setPushing] = useState<string | null>(null)
  const [showPush, setShowPush] = useState<string | null>(null)
  const [pushProjectId, setPushProjectId] = useState(projects[0]?.id ?? '')
  const [pushMarkup, setPushMarkup] = useState('')

  const assignedItemIds = new Set(ss.assignments.map(a => a.item_id))

  async function toggleAssign(itemId: string) {
    const assigned = assignedItemIds.has(itemId)
    setTogglingItem(itemId)
    try {
      if (assigned) {
        await fetch(`/api/sourcing/sessions/${sessionId}/suppliers/${ss.id}/assignments?item_id=${itemId}`, { method: 'DELETE' })
        onAssignToggle(ss.id, itemId, false)
      } else {
        const res = await fetch(`/api/sourcing/sessions/${sessionId}/suppliers/${ss.id}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        onAssignToggle(ss.id, itemId, true)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setTogglingItem(null)
    }
  }

  async function loadMessages() {
    const res = await fetch(`/api/sourcing/sessions/${sessionId}/messages/${ss.id}`)
    const json = await res.json()
    if (json.data) setMessages(json.data)
    setShowMessages(true)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgBody.trim()) return
    setSendingMsg(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/messages/${ss.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: msgBody.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessages(prev => [...prev, json.data])
      setMsgBody('')
    } finally {
      setSendingMsg(false)
    }
  }

  async function handleAccept(itemId: string, assignmentId: string) {
    setAccepting(assignmentId)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/items/${itemId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onAccept(itemId, assignmentId)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAccepting(null)
    }
  }

  async function handlePush(itemId: string) {
    if (!pushProjectId) return
    setPushing(itemId)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/items/${itemId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: pushProjectId, markup_percentage: pushMarkup ? Number(pushMarkup) : 0 }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onPushToProject(itemId, pushProjectId, pushMarkup ? Number(pushMarkup) : 0)
      setShowPush(null)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPushing(null)
    }
  }

  const statusBg = STATUS_COLORS[ss.status] ?? STATUS_COLORS.pending

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden bg-white">
      {/* Supplier header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-[#2C2C2A] truncate">{ss.supplier_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg}`}>
              {ss.status.replace('_', ' ')}
            </span>
            {ss.sent_at && <span className="text-xs text-[#8A877F]">Sent {new Date(ss.sent_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>}
          </div>
          <p className="text-xs text-[#8A877F]">{ss.email} · {assignedItemIds.size} item{assignedItemIds.size !== 1 ? 's' : ''} assigned</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); showMessages ? setShowMessages(false) : loadMessages() }}
            title="Messages"
            className="p-1.5 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(ss.id) }}
            title="Remove supplier"
            className="p-1.5 text-[#8A877F] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-[#8A877F]" /> : <ChevronDown size={14} className="text-[#8A877F]" />}
        </div>
      </div>

      {/* Expanded: items + assignments + prices */}
      {expanded && (
        <div className="border-t border-[#EDE9E1]">
          <div className="px-5 py-3">
            <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wide mb-2">Assign Items</p>
            <div className="space-y-1.5">
              {items.length === 0 && <p className="text-xs text-[#C4BFB5]">No items in session yet.</p>}
              {items.map(item => {
                const isAssigned = assignedItemIds.has(item.id)
                const assignment = ss.assignments.find(a => a.item_id === item.id)
                const hasResponse = !!assignment?.response
                const isAccepted = assignment?.status === 'accepted'

                return (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b border-[#F5F2EC] last:border-0">
                    {/* Toggle assign */}
                    <button
                      type="button"
                      onClick={() => toggleAssign(item.id)}
                      disabled={togglingItem === item.id || isAccepted}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${isAssigned ? 'bg-[#2C2C2A] border-[#2C2C2A]' : 'border-[#D4CFC7] hover:border-[#C4A46B]'} disabled:opacity-40`}
                    >
                      {isAssigned && <Check size={11} className="text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isAssigned ? 'text-[#2C2C2A]' : 'text-[#8A877F]'}`}>{item.title}</p>
                        {item.item_quantity && <span className="text-xs text-[#C4BFB5]">×{item.item_quantity}</span>}
                        {isAccepted && <span className="text-xs text-emerald-600 font-medium">Accepted</span>}
                      </div>

                      {/* Price response */}
                      {hasResponse && assignment?.response && (
                        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-semibold text-[#2C2C2A]">R{assignment.response.unit_price.toLocaleString()}</span>
                          {assignment.response.lead_time_weeks && <span className="text-xs text-[#8A877F]">{assignment.response.lead_time_weeks}w lead</span>}
                          {assignment.response.notes && <span className="text-xs text-[#8A877F] italic truncate max-w-xs">{assignment.response.notes}</span>}
                          {!isAccepted && item.status !== 'accepted' && (
                            <button
                              type="button"
                              onClick={() => handleAccept(item.id, assignment.id)}
                              disabled={accepting === assignment.id}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {accepting === assignment.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                              Accept
                            </button>
                          )}
                          {isAccepted && !showPush && (
                            <button
                              type="button"
                              onClick={() => setShowPush(item.id)}
                              className="text-xs text-[#C4A46B] hover:text-[#9A7B4F] font-medium transition-colors"
                            >
                              Push to project →
                            </button>
                          )}
                        </div>
                      )}

                      {/* Push to project */}
                      {showPush === item.id && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <select
                            value={pushProjectId}
                            onChange={e => setPushProjectId(e.target.value)}
                            className="text-xs border border-[#D4CFC7] rounded-lg px-2 py-1 focus:outline-none focus:border-[#C4A46B] bg-white"
                          >
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.project_name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            value={pushMarkup}
                            onChange={e => setPushMarkup(e.target.value)}
                            placeholder="Markup %"
                            className="text-xs border border-[#D4CFC7] rounded-lg px-2 py-1 w-24 focus:outline-none focus:border-[#C4A46B] bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handlePush(item.id)}
                            disabled={pushing === item.id || !pushProjectId}
                            className="text-xs bg-[#2C2C2A] text-[#F5F2EC] px-3 py-1 rounded-lg font-medium disabled:opacity-50"
                          >
                            {pushing === item.id ? 'Pushing…' : 'Push'}
                          </button>
                          <button type="button" onClick={() => setShowPush(null)} className="text-xs text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {showMessages && (
        <div className="border-t border-[#EDE9E1] px-5 py-4 space-y-3">
          <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wide">Thread</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {messages.length === 0 && <p className="text-xs text-[#C4BFB5]">No messages yet.</p>}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_type === 'designer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.sender_type === 'designer' ? 'bg-[#2C2C2A] text-[#F5F2EC]' : 'bg-[#F5F2EC] text-[#2C2C2A] border border-[#EDE9E1]'}`}>
                  <p className="text-xs leading-relaxed">{m.body}</p>
                  <p className={`text-[10px] mt-0.5 ${m.sender_type === 'designer' ? 'text-[#A09A8E]' : 'text-[#C4BFB5]'}`}>
                    {m.sender_type === 'designer' ? 'You' : ss.supplier_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              value={msgBody}
              onChange={e => setMsgBody(e.target.value)}
              placeholder="Message…"
              className="flex-1 px-3 py-1.5 text-xs border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white"
            />
            <button type="submit" disabled={sendingMsg || !msgBody.trim()} className="px-3 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] rounded-lg text-xs disabled:opacity-40">
              {sendingMsg ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----
export function SourcingDetail({ session, initialItems, initialSuppliers, allSuppliers, projects }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState<SessionItem[]>(initialItems)
  const [suppliers, setSuppliers] = useState<SessionSupplier[]>(initialSuppliers)
  const [sending, setSending] = useState(false)
  const [archiving, setArchiving] = useState(false)

  function handleItemAdded(item: SessionItem) {
    setItems(prev => [...prev, item])
  }

  function handleSupplierAdded(ss: SessionSupplier) {
    setSuppliers(prev => [...prev, ss])
  }

  async function handleRemoveSupplier(ssId: string) {
    if (!window.confirm('Remove this supplier from the session?')) return
    await fetch(`/api/sourcing/sessions/${session.id}/suppliers/${ssId}`, { method: 'DELETE' })
    setSuppliers(prev => prev.filter(s => s.id !== ssId))
  }

  function handleAssignToggle(ssId: string, itemId: string, assigned: boolean) {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== ssId) return s
      if (assigned) {
        const newAssignment: Assignment = {
          id: `temp-${Date.now()}`,
          item_id: itemId,
          status: 'pending',
          responded_at: null,
          accepted_at: null,
          response: null,
        }
        return { ...s, assignments: [...s.assignments, newAssignment] }
      } else {
        return { ...s, assignments: s.assignments.filter(a => a.item_id !== itemId) }
      }
    }))
  }

  function handleAccept(itemId: string, assignmentId: string) {
    // Update all suppliers: the winner gets 'accepted', others get 'declined' for this item
    setSuppliers(prev => prev.map(ss => ({
      ...ss,
      assignments: ss.assignments.map(a => {
        if (a.item_id !== itemId) return a
        if (a.id === assignmentId) return { ...a, status: 'accepted' }
        return { ...a, status: 'declined' }
      }),
    })))
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'accepted' } : item))
    startTransition(() => router.refresh())
  }

  function handlePushToProject(itemId: string) {
    startTransition(() => router.refresh())
  }

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${session.id}/send`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      startTransition(() => router.refresh())
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleArchive() {
    if (!window.confirm('Archive this session?')) return
    setArchiving(true)
    try {
      await fetch(`/api/sourcing/sessions/${session.id}/archive`, { method: 'POST' })
      startTransition(() => router.push('/sourcing'))
    } finally {
      setArchiving(false)
    }
  }

  const canSend = items.length > 0 && suppliers.some(ss => ss.assignments.length > 0)
  const isArchived = session.archived
  const isTerminal = ['completed', 'archived'].includes(session.status)

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft:       { label: 'Draft',       color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
    sent:        { label: 'Sent',        color: 'bg-blue-50 text-blue-600 border border-blue-200' },
    in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-600 border border-amber-200' },
    completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
    archived:    { label: 'Archived',    color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
  }
  const badge = STATUS_LABELS[session.status] ?? STATUS_LABELS.draft

  return (
    <div className="max-w-3xl space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${badge.color}`}>{badge.label}</span>
        <div className="flex items-center gap-2">
          {!isArchived && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] border border-[#D4CFC7] rounded-lg hover:border-[#8A877F] transition-colors"
            >
              {archiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              Archive
            </button>
          )}
          {!isArchived && (
            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg hover:bg-[#3D3D3B] disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {session.status === 'draft' ? 'Send to Suppliers' : 'Resend'}
            </button>
          )}
        </div>
      </div>

      {/* Items section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Items ({items.length})</h2>
        </div>
        <div className="space-y-2 mb-3">
          {items.length === 0 && (
            <div className="border border-dashed border-[#D4CFC7] rounded-xl p-6 text-center">
              <p className="text-xs text-[#8A877F]">Add items to request prices for.</p>
            </div>
          )}
          {items.map(item => (
            <div key={item.id} className="bg-white border border-[#EDE9E1] rounded-xl px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#2C2C2A] truncate">{item.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? STATUS_COLORS.open}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-[#8A877F] mt-0.5">
                  {[item.work_type, item.item_quantity ? `Qty ${item.item_quantity}` : null, item.dimensions, item.colour_finish]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!isArchived && (
          <AddItemForm sessionId={session.id} onAdded={handleItemAdded} />
        )}
      </div>

      {/* Suppliers section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Suppliers ({suppliers.length})</h2>
        </div>
        <div className="space-y-2 mb-3">
          {suppliers.length === 0 && (
            <div className="border border-dashed border-[#D4CFC7] rounded-xl p-6 text-center">
              <p className="text-xs text-[#8A877F]">Add suppliers to assign items and send price requests.</p>
            </div>
          )}
          {suppliers.map(ss => (
            <SupplierCard
              key={ss.id}
              ss={ss}
              items={items}
              sessionId={session.id}
              sessionStatus={session.status}
              onAssignToggle={handleAssignToggle}
              onAccept={handleAccept}
              onPushToProject={handlePushToProject}
              onRemove={handleRemoveSupplier}
              projects={projects}
            />
          ))}
        </div>
        {!isArchived && (
          <AddSupplierForm
            sessionId={session.id}
            allSuppliers={allSuppliers}
            existingEmails={suppliers.map(s => s.email)}
            onAdded={handleSupplierAdded}
          />
        )}
      </div>

      {!canSend && !isArchived && items.length > 0 && suppliers.length > 0 && (
        <p className="text-xs text-[#8A877F]">Assign at least one item to a supplier before sending.</p>
      )}
    </div>
  )
}
