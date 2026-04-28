'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Send, Archive, Loader2, ChevronDown, ChevronUp,
  MessageSquare, X, Check, CheckCircle2, RefreshCw, Lock, ImagePlus,
  AlertTriangle, ArrowRight, BarChart3,
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
  ref_image_urls: string[] | null
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

// ---- Push Preview Modal ----
interface PushModalProps {
  item: SessionItem
  assignment: Assignment
  response: Response
  supplierName: string
  projects: Props['projects']
  sessionId: string
  sessionProjectId: string | null
  onClose: () => void
  onPushed: (projectId: string) => void
}

function PushModal({ item, assignment, response, supplierName, projects, sessionId, sessionProjectId, onClose, onPushed }: PushModalProps) {
  const defaultProjectId = sessionProjectId && projects.some(p => p.id === sessionProjectId)
    ? sessionProjectId
    : ''
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [markup, setMarkup] = useState('0')
  const [itemName, setItemName] = useState(item.title)
  const [description, setDescription] = useState(item.specifications ?? '')
  const [quantity, setQuantity] = useState(String(item.item_quantity ?? 1))
  const [dimensions, setDimensions] = useState(item.dimensions ?? '')
  const [colourFinish, setColourFinish] = useState(item.colour_finish ?? '')
  const [pushing, setPushing] = useState(false)

  const costPrice = response.unit_price
  const markupNum = Number(markup) || 0
  const sellPrice = costPrice * (1 + markupNum / 100)
  const lineTotal = (Number(quantity) || 1) * sellPrice

  const hasVariation = response.notes && !response.notes.startsWith("[CAN'T SUPPLY]")

  async function handlePush() {
    if (!projectId) return
    setPushing(true)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/items/${item.id}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          markup_percentage: markupNum,
          overrides: {
            item_name: itemName.trim() || item.title,
            description: description.trim() || null,
            quantity: Number(quantity) || 1,
            dimensions: dimensions.trim() || null,
            colour_finish: colourFinish.trim() || null,
          },
        }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onPushed(projectId)
      onClose()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EDE9E1]">
          <div>
            <h2 className="text-base font-bold text-[#2C2C2A]">Review & Push to Quote</h2>
            <p className="text-xs text-[#8A877F] mt-0.5">Edit any details before adding to the project</p>
          </div>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Supplier notes / variations — prominent warning */}
          {hasVariation && (
            <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">Supplier notes / variations</p>
                <p className="text-sm text-amber-800 leading-relaxed">{response.notes}</p>
                <p className="text-[11px] text-amber-600 mt-1.5">Review the details below and edit if needed before pushing.</p>
              </div>
            </div>
          )}

          {/* Supplier + cost summary */}
          <div className="bg-[#F5F2EC] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#8A877F]">Supplier</span>
              <span className="font-medium text-[#2C2C2A]">{supplierName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8A877F]">Cost price (excl. VAT)</span>
              <span className="font-semibold text-[#2C2C2A]">R{costPrice.toLocaleString()}</span>
            </div>
            {response.lead_time_weeks && (
              <div className="flex justify-between text-sm">
                <span className="text-[#8A877F]">Lead time</span>
                <span className="text-[#2C2C2A]">{response.lead_time_weeks} weeks</span>
              </div>
            )}
          </div>

          {/* Editable line item fields */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Line Item Details</p>
            <div>
              <label className="block text-xs font-medium text-[#8A877F] mb-1">Item name</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A877F] mb-1">Description / Specification</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                className={`${INPUT} resize-none`} placeholder="Leave blank to omit" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#8A877F] mb-1">Quantity</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#8A877F] mb-1">Dimensions</label>
                <input value={dimensions} onChange={e => setDimensions(e.target.value)} className={INPUT} placeholder="e.g. 2400 × 900 × 760" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A877F] mb-1">Colour / Finish</label>
              <input value={colourFinish} onChange={e => setColourFinish(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Markup + sell price */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Pricing</p>
            <div className="flex gap-3 items-end">
              <div className="w-28">
                <label className="block text-xs font-medium text-[#8A877F] mb-1">Markup %</label>
                <input type="number" min="0" max="500" value={markup} onChange={e => setMarkup(e.target.value)} className={INPUT} />
              </div>
              <div className="flex-1 bg-[#F5F2EC] rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A877F]">Sell price (per unit)</span>
                  <span className="font-semibold text-[#2C2C2A]">R{sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#D4CFC7] pt-1.5">
                  <span className="text-[#8A877F]">Line total (×{quantity})</span>
                  <span className="font-bold text-[#2C2C2A]">R{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project picker */}
          {projects.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[#8A877F] mb-1">Push to project</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className={INPUT}>
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-xs text-[#8A877F] bg-[#F5F2EC] rounded-lg p-3">No projects found. Create a project first.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-[#8A877F] border border-[#D4CFC7] rounded-xl hover:border-[#8A877F] transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || !projectId}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ background: '#2C2C2A', color: '#F5F2EC' }}
          >
            {pushing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {pushing ? 'Pushing…' : 'Push to Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Comparison Table ----
function ComparisonTable({
  items, suppliers, onAccept, accepting, onOpenPush, pushedItems, projects,
}: {
  items: SessionItem[]
  suppliers: SessionSupplier[]
  onAccept: (itemId: string, assignmentId: string) => void
  accepting: string | null
  onOpenPush: (item: SessionItem, assignment: Assignment, response: Response, supplierName: string) => void
  pushedItems: Record<string, string>
  projects: Props['projects']
}) {
  const hasAnyResponse = suppliers.some(ss => ss.assignments.some(a => a.response !== null || a.status === 'supplier_declined'))
  if (!hasAnyResponse) return null

  const assignedItems = items.filter(item =>
    suppliers.some(ss => ss.assignments.some(a => a.item_id === item.id))
  )
  if (assignedItems.length === 0) return null

  return (
    <div className="bg-white border border-[#EDE9E1] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#EDE9E1]">
        <BarChart3 size={14} className="text-[#8A877F]" />
        <p className="text-sm font-semibold text-[#2C2C2A]">Pricing Comparison</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F2EC]" style={{ background: '#FAFAF8' }}>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#A1A1AA] min-w-[140px]">Item</th>
              {suppliers.map(ss => (
                <th key={ss.id} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#A1A1AA] min-w-[140px]">
                  {ss.supplier_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignedItems.map(item => (
              <tr key={item.id} className="border-b border-[#F5F2EC] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#2C2C2A] text-sm">{item.title}</p>
                  {item.item_quantity && <p className="text-xs text-[#C4BFB5]">×{item.item_quantity}</p>}
                </td>
                {suppliers.map(ss => {
                  const assignment = ss.assignments.find(a => a.item_id === item.id)
                  const isAccepted = assignment?.status === 'accepted'
                  const isSupplierDeclined = assignment?.status === 'supplier_declined'
                  const hasResponse = !!assignment?.response && !isSupplierDeclined

                  if (!assignment) {
                    return <td key={ss.id} className="px-4 py-3 text-xs text-[#C4BFB5]">Not assigned</td>
                  }
                  if (isSupplierDeclined) {
                    return (
                      <td key={ss.id} className="px-4 py-3">
                        <span className="text-xs font-medium text-red-500">Can&apos;t supply</span>
                        {assignment.response?.notes && (
                          <p className="text-[10px] text-[#A1A1AA] mt-0.5 max-w-[140px] truncate">
                            {assignment.response.notes.replace("[CAN'T SUPPLY] ", '')}
                          </p>
                        )}
                      </td>
                    )
                  }
                  if (!hasResponse) {
                    return <td key={ss.id} className="px-4 py-3 text-xs text-[#C4BFB5]">Awaiting</td>
                  }

                  const response = assignment.response!
                  return (
                    <td key={ss.id} className="px-4 py-3" style={{ background: isAccepted ? '#F0FDF4' : undefined }}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#2C2C2A]">R{response.unit_price.toLocaleString()}</p>
                          {response.lead_time_weeks && (
                            <p className="text-[10px] text-[#8A877F]">{response.lead_time_weeks}w lead</p>
                          )}
                          {response.notes && !response.notes.startsWith("[CAN'T SUPPLY]") && (
                            <p className="text-[10px] text-amber-600 mt-0.5 max-w-[120px] truncate" title={response.notes}>
                              ⚠ {response.notes}
                            </p>
                          )}
                        </div>
                        {isAccepted ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            {pushedItems[item.id] ? (
                              <a
                                href={`/projects/${pushedItems[item.id]}`}
                                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium whitespace-nowrap transition-colors underline underline-offset-2"
                              >
                                {projects.find(p => p.id === pushedItems[item.id])?.project_name ?? 'View project'} ↗
                              </a>
                            ) : (
                              <button
                                onClick={() => onOpenPush(item, assignment, response, ss.supplier_name)}
                                className="text-[10px] text-[#C4A46B] hover:text-[#9A7B4F] font-medium whitespace-nowrap transition-colors"
                              >
                                Push →
                              </button>
                            )}
                          </div>
                        ) : (
                          item.status !== 'accepted' && (
                            <button
                              onClick={() => onAccept(item.id, assignment.id)}
                              disabled={accepting === assignment.id}
                              className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {accepting === assignment.id ? '…' : 'Accept'}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---- Supplier Card ----
function SupplierCard({
  ss, items, sessionId, sessionStatus,
  onAssignToggle, onAccept, onOpenPush, onRemove, pushedItems, projects,
}: {
  ss: SessionSupplier
  items: SessionItem[]
  sessionId: string
  sessionStatus: string
  onAssignToggle: (ssId: string, itemId: string, assigned: boolean) => void
  onAccept: (itemId: string, assignmentId: string) => void
  onOpenPush: (item: SessionItem, assignment: Assignment, response: Response, supplierName: string) => void
  onRemove: (ssId: string) => void
  pushedItems: Record<string, string>
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

  const assignedItemIds = new Set(ss.assignments.map(a => a.item_id))
  const assignedItems = items.filter(item => assignedItemIds.has(item.id))
  const unassignedItems = items.filter(item => !assignedItemIds.has(item.id))
  const isDraft = sessionStatus === 'draft'
  const isArchived = ss.status === 'declined'
  const allAccepted = ss.assignments.length > 0 && ss.assignments.every(a => a.status === 'accepted')

  const effectiveStatus = ss.sent_at && ss.status === 'pending' ? 'sent' : ss.status

  const STATUS_COLORS: Record<string, string> = {
    pending:     'bg-[#F5F2EC] text-[#8A877F]',
    sent:        'bg-blue-50 text-blue-600',
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

  const statusColor = STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS.pending

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
              {effectiveStatus.replace('_', ' ')}
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
                        {isAccepted && assignment?.response && (
                          pushedItems[item.id] ? (
                            <a
                              href={`/projects/${pushedItems[item.id]}`}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors underline underline-offset-2"
                            >
                              {projects.find(p => p.id === pushedItems[item.id])?.project_name ?? 'View project'} ↗
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenPush(item, assignment, assignment.response!, ss.supplier_name)}
                              className="text-xs text-[#C4A46B] hover:text-[#9A7B4F] font-medium transition-colors"
                            >
                              Push to project →
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {!hasResponse && !isAccepted && (
                      <p className="text-xs text-[#C4BFB5] mt-1">Awaiting response</p>
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
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pushModal, setPushModal] = useState<{
    item: SessionItem; assignment: Assignment; response: Response; supplierName: string
  } | null>(null)
  // keyed by item.id → project_id that was pushed to
  const [pushedItems, setPushedItems] = useState<Record<string, string>>({})

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

  function handlePushToProject(projectId: string) {
    if (pushModal) {
      setPushedItems(prev => ({ ...prev, [pushModal.item.id]: projectId }))
    }
    startTransition(() => router.refresh())
  }

  async function handleAcceptFromTable(itemId: string, assignmentId: string) {
    setAccepting(assignmentId)
    try {
      const res = await fetch(`/api/sourcing/sessions/${session.id}/items/${itemId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      handleAccept(itemId, assignmentId)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAccepting(null)
    }
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
      {/* Push Preview Modal */}
      {pushModal && (
        <PushModal
          item={pushModal.item}
          assignment={pushModal.assignment}
          response={pushModal.response}
          supplierName={pushModal.supplierName}
          projects={projects}
          sessionId={session.id}
          sessionProjectId={session.project_id}
          onClose={() => setPushModal(null)}
          onPushed={handlePushToProject}
        />
      )}

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

      {/* Pricing Comparison Table */}
      <ComparisonTable
        items={items}
        suppliers={suppliers}
        onAccept={handleAcceptFromTable}
        accepting={accepting}
        onOpenPush={(item, assignment, response, supplierName) =>
          setPushModal({ item, assignment, response, supplierName })
        }
        pushedItems={pushedItems}
        projects={projects}
      />

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
                <div key={item.id} className="bg-white border border-[#EDE9E1] rounded-xl px-4 py-3 flex items-center gap-3">
                  {item.ref_image_urls && item.ref_image_urls.length > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.ref_image_urls[0]}
                      alt={item.title}
                      className="w-12 h-12 object-cover rounded-lg border border-[#EDE9E1] shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
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
                  onOpenPush={(item, assignment, response, supplierName) =>
                    setPushModal({ item, assignment, response, supplierName })
                  }
                  onRemove={handleRemoveSupplier}
                  pushedItems={pushedItems}
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
