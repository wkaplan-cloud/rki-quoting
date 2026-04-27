'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Send, Archive, Loader2, ChevronDown, ChevronUp,
  MessageSquare, X, Check, CheckCircle2, RefreshCw, Lock, ImagePlus,
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

const INPUT = 'w-full px-3 py-2 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white'

// ---- Add Item Form ----
function AddItemForm({ sessionId, onAdded }: { sessionId: string; onAdded: (item: SessionItem) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [workType, setWorkType] = useState('')
  const [qty, setQty] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [colourFinish, setColourFinish] = useState('')
  const [specs, setSpecs] = useState('')
  const [refImages, setRefImages] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setRefImages(prev => [...prev, ...files].slice(0, 5))
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      // Upload ref images first if any
      let refImageUrls: string[] = []
      if (refImages.length > 0) {
        const formData = new FormData()
        refImages.forEach(f => formData.append('files', f))
        formData.append('session_id', sessionId)
        const uploadRes = await fetch(`/api/sourcing/sessions/${sessionId}/item-images`, {
          method: 'POST',
          body: formData,
        })
        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json()
          refImageUrls = uploadJson.urls ?? []
        }
      }

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
          ref_image_urls: refImageUrls.length > 0 ? refImageUrls : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded(json.data)
      setTitle(''); setWorkType(''); setQty(''); setDimensions(''); setColourFinish(''); setSpecs(''); setRefImages([])
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
      <div className="space-y-2">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Item name *" required className={INPUT} />
        <div className="grid grid-cols-2 gap-2">
          <input value={workType} onChange={e => setWorkType(e.target.value)} placeholder="Category" className={INPUT} />
          <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="Quantity" className={INPUT} />
          <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions" className={INPUT} />
          <input value={colourFinish} onChange={e => setColourFinish(e.target.value)} placeholder="Colour / Finish" className={INPUT} />
        </div>
        <textarea value={specs} onChange={e => setSpecs(e.target.value)} rows={2} placeholder="Specifications" className={`${INPUT} resize-none`} />

        {/* Ref images */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[#8A877F] hover:text-[#2C2C2A] transition-colors w-fit">
            <ImagePlus size={13} />
            Add reference images (up to 5)
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          </label>
          {refImages.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {refImages.map((f, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-14 h-14 object-cover rounded-lg border border-[#D4CFC7]"
                  />
                  <button
                    type="button"
                    onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setRefImages([]) }} className="px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
        <button type="submit" disabled={saving || !title.trim()} className="px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// ---- Add Supplier Form (with inline item assignment) ----
function AddSupplierForm({
  sessionId,
  allSuppliers,
  existingEmails,
  onAdded,
  items,
}: {
  sessionId: string
  allSuppliers: { id: string; supplier_name: string; email: string | null }[]
  existingEmails: string[]
  onAdded: (ss: SessionSupplier) => void
  items: SessionItem[]
}) {
  const [open, setOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('')
  const [email, setEmail] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleItem(id: string) {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

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
      const newSS = json.data

      // Assign selected items in parallel
      const assignResults = await Promise.all(
        selectedItemIds.map(itemId =>
          fetch(`/api/sourcing/sessions/${sessionId}/suppliers/${newSS.id}/assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId }),
          }).then(r => r.json())
        )
      )

      const assignments: Assignment[] = assignResults
        .filter(r => r.data)
        .map(r => ({
          id: r.data.id,
          item_id: r.data.item_id,
          status: 'pending',
          responded_at: null,
          accepted_at: null,
          response: null,
        }))

      onAdded({ ...newSS, assignments })
      setSupplierName(''); setEmail(''); setSupplierId(null); setSelectedItemIds([]); setOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = allSuppliers.filter(
    s => s.supplier_name.toLowerCase().includes(supplierName.toLowerCase()) && !existingEmails.includes(s.email ?? '')
  )

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors py-1">
        <Plus size={14} /> Add Supplier
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[#C4A46B] rounded-xl p-4 space-y-3 bg-[#FEFDF9]">
      <div className="relative">
        <input
          autoFocus
          value={supplierName}
          onChange={e => { setSupplierName(e.target.value); setSupplierId(null) }}
          placeholder="Supplier name *"
          required
          className={INPUT}
        />
        {supplierName.length > 1 && filtered.length > 0 && !supplierId && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#EDE9E1] rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
            {filtered.slice(0, 6).map(s => (
              <button key={s.id} type="button" onClick={() => handleSelectSupplier(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors">
                <span className="font-medium text-[#2C2C2A]">{s.supplier_name}</span>
                {s.email && <span className="text-[#8A877F] ml-2">{s.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address *" required className={INPUT} />

      {items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#8A877F] uppercase tracking-wide mb-2">Assign items</p>
          <div className="space-y-1.5">
            {items.map(item => {
              const checked = selectedItemIds.includes(item.id)
              return (
                <label key={item.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => toggleItem(item.id)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[#2C2C2A] border-[#2C2C2A]' : 'border-[#D4CFC7] group-hover:border-[#C4A46B]'}`}
                  >
                    {checked && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-sm text-[#2C2C2A]">{item.title}</span>
                  {item.item_quantity && <span className="text-xs text-[#C4BFB5]">×{item.item_quantity}</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setSelectedItemIds([]) }} className="px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
        <button type="submit" disabled={saving || !supplierName.trim() || !email.trim()} className="px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Supplier'}
        </button>
      </div>
    </form>
  )
}

// ---- Supplier Card ----
function SupplierCard({
  ss, items, sessionId, sessionStatus,
  onAssignToggle, onAccept, onPushToProject, onRemove, projects,
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
  const [showAddItems, setShowAddItems] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [messages, setMessages] = useState<{ id: string; sender_type: string; body: string; created_at: string }[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [msgBody, setMsgBody] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pushing, setPushing] = useState<string | null>(null)
  const [showPush, setShowPush] = useState<string | null>(null)
  const [pushProjectId, setPushProjectId] = useState(projects[0]?.id ?? '')
  const [pushMarkup, setPushMarkup] = useState('')

  const assignedItemIds = new Set(ss.assignments.map(a => a.item_id))
  const assignedItems = items.filter(item => assignedItemIds.has(item.id))
  const unassignedItems = items.filter(item => !assignedItemIds.has(item.id))
  const isDraft = sessionStatus === 'draft'
  const isArchived = ss.status === 'declined'
  const allAccepted = ss.assignments.length > 0 && ss.assignments.every(a => a.status === 'accepted')

  const STATUS_COLORS: Record<string, string> = {
    pending:     'bg-[#F5F2EC] text-[#8A877F]',
    viewed:      'bg-sky-50 text-sky-600',
    in_progress: 'bg-amber-50 text-amber-600',
    responded:   'bg-amber-50 text-amber-600',
    completed:   'bg-emerald-50 text-emerald-600',
    declined:    'bg-red-50 text-red-400',
  }

  async function loadMessages() {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/messages/${ss.id}`)
      const json = await res.json()
      if (json.data) setMessages(json.data)
      setShowMessages(true)
    } finally {
      setLoadingMsgs(false)
    }
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

  const statusColor = STATUS_COLORS[ss.status] ?? STATUS_COLORS.pending

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FAFAF8] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-[#2C2C2A] truncate">{ss.supplier_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {ss.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-[#8A877F] mt-0.5">{ss.email} · {assignedItems.length} item{assignedItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isDraft && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); showMessages ? setShowMessages(false) : loadMessages() }}
              title="Messages"
              className="p-1.5 text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] rounded-lg transition-colors"
            >
              <MessageSquare size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(ss.id) }}
            className="p-1.5 text-[#8A877F] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={13} />
          </button>
          {expanded ? <ChevronUp size={13} className="text-[#8A877F]" /> : <ChevronDown size={13} className="text-[#8A877F]" />}
        </div>
      </div>

      {/* Expanded: assigned items with responses */}
      {expanded && (
        <div className="border-t border-[#EDE9E1]">
          {assignedItems.length === 0 ? (
            <p className="text-xs text-[#C4BFB5] px-4 py-3">No items assigned yet.</p>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {assignedItems.map(item => {
                const assignment = ss.assignments.find(a => a.item_id === item.id)
                const isAccepted = assignment?.status === 'accepted'
                const hasResponse = !!assignment?.response

                return (
                  <div key={item.id} className="py-2 border-b border-[#F5F2EC] last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isAccepted && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                      <p className="text-sm font-medium text-[#2C2C2A]">{item.title}</p>
                      {item.item_quantity && <span className="text-xs text-[#C4BFB5]">×{item.item_quantity}</span>}
                      {isAccepted && <span className="text-xs text-emerald-600 font-medium">Accepted</span>}
                    </div>

                    {hasResponse && assignment?.response && (
                      <div className="flex items-center gap-3 flex-wrap mt-1">
                        <span className="text-sm font-semibold text-[#2C2C2A]">R{assignment.response.unit_price.toLocaleString()}</span>
                        {assignment.response.lead_time_weeks && <span className="text-xs text-[#8A877F]">{assignment.response.lead_time_weeks}w lead</span>}
                        {assignment.response.notes && <span className="text-xs text-[#8A877F] italic truncate max-w-[180px]">{assignment.response.notes}</span>}
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

                    {!hasResponse && !isAccepted && (
                      <p className="text-xs text-[#C4BFB5] mt-1">Awaiting response</p>
                    )}

                    {showPush === item.id && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <select value={pushProjectId} onChange={e => setPushProjectId(e.target.value)}
                          className="text-xs border border-[#D4CFC7] rounded-lg px-2 py-1 focus:outline-none bg-white">
                          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                        </select>
                        <input type="number" min="0" max="200" value={pushMarkup} onChange={e => setPushMarkup(e.target.value)}
                          placeholder="Markup %" className="text-xs border border-[#D4CFC7] rounded-lg px-2 py-1 w-24 focus:outline-none bg-white" />
                        <button type="button" onClick={() => handlePush(item.id)} disabled={pushing === item.id || !pushProjectId}
                          className="text-xs bg-[#2C2C2A] text-[#F5F2EC] px-3 py-1 rounded-lg font-medium disabled:opacity-50">
                          {pushing === item.id ? 'Pushing…' : 'Push'}
                        </button>
                        <button type="button" onClick={() => setShowPush(null)} className="text-xs text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Assign more items (unassigned only) */}
          {unassignedItems.length > 0 && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => setShowAddItems(s => !s)}
                className="text-xs text-[#8A877F] hover:text-[#2C2C2A] transition-colors flex items-center gap-1"
              >
                <Plus size={11} /> Assign more items
              </button>
              {showAddItems && (
                <div className="mt-2 space-y-1.5">
                  {unassignedItems.map(item => (
                    <label key={item.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => !togglingItem && toggleAssign(item.id)}
                        className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors border-[#D4CFC7] group-hover:border-[#C4A46B]"
                      >
                        {togglingItem === item.id && <Loader2 size={9} className="animate-spin text-[#8A877F]" />}
                      </div>
                      <span className="text-sm text-[#2C2C2A]">{item.title}</span>
                      {item.item_quantity && <span className="text-xs text-[#C4BFB5]">×{item.item_quantity}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages — only visible after sending */}
      {!isDraft && showMessages && (
        <div className="border-t border-[#EDE9E1] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#8A877F] uppercase tracking-wide">Thread</p>
            <button
              type="button"
              onClick={loadMessages}
              disabled={loadingMsgs}
              title="Refresh messages"
              className="p-1 text-[#8A877F] hover:text-[#2C2C2A] transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={loadingMsgs ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {messages.length === 0 && <p className="text-xs text-[#C4BFB5]">No messages yet.</p>}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_type === 'designer' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-2"
                  style={m.sender_type === 'designer'
                    ? { background: '#7C3AED', color: '#FFFFFF', borderBottomRightRadius: 4 }
                    : { background: '#0D9488', color: '#FFFFFF', borderBottomLeftRadius: 4 }
                  }
                >
                  <p className="text-xs leading-relaxed">{m.body}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {m.sender_type === 'designer' ? 'You' : ss.supplier_name}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {allAccepted ? (
            <div className="flex items-center gap-2 py-2 text-xs text-[#8A877F]">
              <Lock size={11} />
              <span>Pricing accepted — thread closed</span>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex gap-2 pt-1">
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
          )}
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

  const isDraft = session.status === 'draft'
  const isArchived = session.archived

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft:       { label: 'Draft',       color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
    sent:        { label: 'Sent',        color: 'bg-blue-50 text-blue-600 border border-blue-200' },
    in_progress: { label: 'In Progress', color: 'bg-amber-50 text-amber-600 border border-amber-200' },
    completed:   { label: 'Completed',   color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
    archived:    { label: 'Archived',    color: 'bg-[#F5F2EC] text-[#8A877F] border border-[#D4CFC7]' },
  }
  const badge = STATUS_LABELS[session.status] ?? STATUS_LABELS.draft

  function handleItemAdded(item: SessionItem) {
    setItems(prev => [...prev, item])
  }

  function handleSupplierAdded(ss: SessionSupplier) {
    setSuppliers(prev => [...prev, ss])
  }

  async function handleRemoveSupplier(ssId: string) {
    if (!window.confirm('Remove this supplier from this price request?')) return
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
      }
      return { ...s, assignments: s.assignments.filter(a => a.item_id !== itemId) }
    }))
  }

  function handleAccept(itemId: string, assignmentId: string) {
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
    if (!window.confirm('Archive this price request?')) return
    setArchiving(true)
    try {
      await fetch(`/api/sourcing/sessions/${session.id}/archive`, { method: 'POST' })
      startTransition(() => router.push('/sourcing'))
    } finally {
      setArchiving(false)
    }
  }

  const canSend = items.length > 0 && suppliers.some(ss => ss.assignments.length > 0)

  return (
    <div className="max-w-5xl space-y-5">
      {/* Status + actions bar */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${badge.color}`}>{badge.label}</span>
        <div className="flex items-center gap-2">
          {session.status === 'completed' && !isArchived && (
            <button onClick={handleArchive} disabled={archiving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] border border-[#D4CFC7] rounded-lg hover:border-[#8A877F] transition-colors">
              {archiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              Archive
            </button>
          )}
          {!isArchived && (
            <button onClick={handleSend} disabled={sending || !canSend}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg hover:bg-[#3D3D3B] disabled:opacity-40 transition-colors">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isDraft ? 'Send to Suppliers' : 'Resend'}
            </button>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Items */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Items ({items.length})</h2>
          {items.length === 0 ? (
            <div className="border border-dashed border-[#D4CFC7] rounded-xl p-6 text-center">
              <p className="text-xs text-[#8A877F]">Add items to request prices for.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="bg-white border border-[#EDE9E1] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    {item.status === 'accepted' && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                    <p className="text-sm font-medium text-[#2C2C2A] truncate">{item.title}</p>
                    {item.status === 'accepted' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">accepted</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8A877F] mt-0.5">
                    {[item.work_type, item.item_quantity ? `Qty ${item.item_quantity}` : null, item.dimensions, item.colour_finish]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
          {!isArchived && <AddItemForm sessionId={session.id} onAdded={handleItemAdded} />}
        </div>

        {/* Right: Suppliers */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#2C2C2A]">Suppliers ({suppliers.length})</h2>
          {suppliers.length === 0 ? (
            <div className="border border-dashed border-[#D4CFC7] rounded-xl p-6 text-center">
              <p className="text-xs text-[#8A877F]">Add suppliers to assign items to.</p>
            </div>
          ) : (
            <div className="space-y-2">
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
          )}
          {!isArchived && (
            <AddSupplierForm
              sessionId={session.id}
              allSuppliers={allSuppliers}
              existingEmails={suppliers.map(s => s.email)}
              onAdded={handleSupplierAdded}
              items={items}
            />
          )}
        </div>
      </div>

      {!canSend && !isArchived && items.length > 0 && suppliers.length > 0 && isDraft && (
        <p className="text-xs text-[#8A877F]">Assign at least one item to a supplier before sending.</p>
      )}
    </div>
  )
}
