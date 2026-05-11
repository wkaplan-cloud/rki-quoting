'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Send, Archive, Loader2, ChevronDown, ChevronUp,
  X, Check, CheckCircle2, ImagePlus,
  AlertTriangle, ArrowRight, BarChart3,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_FIELDS, type CategoryKey } from '@/lib/sourcing-categories'

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
  category: string
  item_specs: Record<string, string> | null
}

interface Response {
  id: string
  unit_price: number
  lead_time_weeks: number | null
  notes: string | null
  supplier_specs: Record<string, string> | null
}

interface Assignment {
  id: string
  item_id: string
  status: string
  responded_at: string | null
  accepted_at: string | null
  created_at: string | null
  pending_supplier_specs: Record<string, string> | null
  spec_approval_status: string | null
  spec_approved_at: string | null
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
  supplier_message_count: number
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
function AddItemForm({ sessionId, onAdded, sortOrder }: { sessionId: string; onAdded: (item: SessionItem) => void; sortOrder: number }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('')
  const [specs, setSpecs] = useState('')
  const [refImages, setRefImages] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<CategoryKey>('general')
  const [specValues, setSpecValues] = useState<Record<string, string>>({})

  // General-only fields
  const [workType, setWorkType] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [colourFinish, setColourFinish] = useState('')

  function handleCategoryChange(key: CategoryKey) {
    setCategory(key)
    setSpecValues({})
  }

  function setSpec(key: string, val: string) {
    setSpecValues(prev => ({ ...prev, [key]: val }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setRefImages(prev => [...prev, ...files].slice(0, 5))
    e.target.value = ''
  }

  function reset() {
    setTitle(''); setQty(''); setSpecs(''); setRefImages([])
    setCategory('general'); setSpecValues({})
    setWorkType(''); setDimensions(''); setColourFinish('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      let refImageUrls: string[] = []
      if (refImages.length > 0) {
        const formData = new FormData()
        refImages.forEach(f => formData.append('files', f))
        formData.append('session_id', sessionId)
        const uploadRes = await fetch(`/api/sourcing/sessions/${sessionId}/item-images`, { method: 'POST', body: formData })
        if (uploadRes.ok) refImageUrls = (await uploadRes.json()).urls ?? []
      }

      const cleanSpecs = Object.fromEntries(Object.entries(specValues).filter(([, v]) => v.trim()))
      const isGeneral = category === 'general'

      const res = await fetch(`/api/sourcing/sessions/${sessionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          item_quantity: qty ? Number(qty) : null,
          specifications: specs.trim() || null,
          ref_image_urls: refImageUrls.length > 0 ? refImageUrls : null,
          category,
          sort_order: sortOrder,
          // General category keeps legacy fields; specific categories use item_specs
          work_type: isGeneral ? (workType.trim() || null) : null,
          dimensions: isGeneral ? (dimensions.trim() || null) : null,
          colour_finish: isGeneral ? (colourFinish.trim() || null) : null,
          item_specs: !isGeneral && Object.keys(cleanSpecs).length > 0 ? cleanSpecs : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded(json.data)
      reset()
      setOpen(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors py-1">
        <Plus size={14} /> Add Item
      </button>
    )
  }

  const fields = CATEGORY_FIELDS[category]

  return (
    <form onSubmit={handleSubmit} className="border border-[#C4A46B] rounded-xl p-4 space-y-4 bg-[#FEFDF9]">
      {/* Item name + qty */}
      <div className="grid grid-cols-3 gap-2">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Item name *" required className={`${INPUT} col-span-2`} />
        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" className={INPUT} />
      </div>

      {/* Category picker */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-2">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategoryChange(cat.key as CategoryKey)}
              className="px-3 py-1 text-xs font-medium rounded-full border transition-colors"
              style={category === cat.key
                ? { background: '#2C2C2A', color: '#F5F2EC', borderColor: '#2C2C2A' }
                : { background: 'white', color: '#8A877F', borderColor: '#D4CFC7' }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* General: legacy free-text fields */}
      {category === 'general' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={workType} onChange={e => setWorkType(e.target.value)} placeholder="Work type / Category" className={INPUT} />
            <input value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions" className={INPUT} />
          </div>
          <input value={colourFinish} onChange={e => setColourFinish(e.target.value)} placeholder="Colour / Finish" className={INPUT} />
        </div>
      )}

      {/* Specific category: structured fields */}
      {fields.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Specifications <span className="normal-case font-normal text-[#C4BFB5]">— fill in what you know</span></p>
          <div className="grid grid-cols-2 gap-2">
            {fields.map(field => {
              const val = specValues[field.key] ?? ''
              const commonClass = `${INPUT} text-sm`
              if (field.type === 'select') {
                return (
                  <div key={field.key}>
                    <label className="block text-[10px] text-[#8A877F] mb-0.5">{field.label}</label>
                    <select value={val} onChange={e => setSpec(field.key, e.target.value)} className={commonClass}>
                      <option value="">—</option>
                      {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )
              }
              if (field.type === 'textarea') {
                return (
                  <div key={field.key} className="col-span-2">
                    <label className="block text-[10px] text-[#8A877F] mb-0.5">{field.label}</label>
                    <textarea value={val} onChange={e => setSpec(field.key, e.target.value)} rows={2} placeholder={field.placeholder} className={`${commonClass} resize-none`} />
                  </div>
                )
              }
              return (
                <div key={field.key}>
                  <label className="block text-[10px] text-[#8A877F] mb-0.5">
                    {field.label}{field.unit && <span className="text-[#C4BFB5] ml-1">({field.unit})</span>}
                  </label>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    min={field.type === 'number' ? '0' : undefined}
                    step={field.type === 'number' ? 'any' : undefined}
                    value={val}
                    onChange={e => setSpec(field.key, e.target.value)}
                    placeholder={field.placeholder ?? (field.unit ? `e.g. 600` : '')}
                    className={commonClass}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Comments — always visible for all categories */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-2">Comments</p>
        <textarea
          value={specs}
          onChange={e => setSpecs(e.target.value)}
          rows={3}
          placeholder="Additional notes, special requirements, or comments for the supplier…"
          className={`${INPUT} resize-none`}
        />
      </div>

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
                <img src={URL.createObjectURL(f)} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-[#D4CFC7]" />
                <button
                  type="button"
                  onClick={() => setRefImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { reset(); setOpen(false) }} className="px-3 py-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A]">Cancel</button>
        <button type="submit" disabled={saving || !title.trim()} className="px-4 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// ---- Add Supplier Form (full-width, always open when rendered) ----
function AddSupplierForm({
  sessionId,
  allSuppliers,
  existingEmails,
  onAdded,
  onClose,
  items,
}: {
  sessionId: string
  allSuppliers: { id: string; supplier_name: string; email: string | null }[]
  existingEmails: string[]
  onAdded: (ss: SessionSupplier) => void
  onClose: () => void
  items: SessionItem[]
}) {
  const [supplierName, setSupplierName] = useState('')
  const [email, setEmail] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(items.map(i => i.id))
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
          created_at: r.data.created_at ?? new Date().toISOString(),
          pending_supplier_specs: null,
          spec_approval_status: null,
          spec_approved_at: null,
          response: null,
        }))

      onAdded({ ...newSS, assignments })
      onClose()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = allSuppliers.filter(
    s => s.supplier_name.toLowerCase().includes(supplierName.toLowerCase()) && !existingEmails.includes(s.email ?? '')
  )

  return (
    <div className="bg-white border border-[#C4A46B] rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EDE9E1]">
        <p className="text-sm font-semibold text-[#2C2C2A]">Add Supplier</p>
        <button type="button" onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
          <X size={15} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: supplier identity */}
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-1">Supplier Name *</label>
              <input
                autoFocus
                value={supplierName}
                onChange={e => { setSupplierName(e.target.value); setSupplierId(null) }}
                placeholder="Start typing to search…"
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
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-1">Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="supplier@example.com" required className={INPUT} />
            </div>
          </div>

          {/* Right: item assignment */}
          {items.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-2">Assign Items</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#EDE9E1]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] border border-[#D4CFC7] rounded-lg hover:border-[#8A877F] transition-colors">Cancel</button>
          <button type="submit" disabled={saving || !supplierName.trim() || !email.trim()} className="px-5 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold rounded-lg disabled:opacity-50 transition-opacity">
            {saving ? 'Adding…' : 'Add Supplier'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---- Spec Approval Panel ----
// Full editable form of all category fields, pre-filled with supplier's proposed values.
// Changed fields are highlighted. Designer can edit any value before approving.
function SpecApprovalPanel({
  item,
  assignment,
  supplierName,
  onApprove,
  onReject,
  isApproving,
}: {
  item: SessionItem
  assignment: Assignment
  supplierName: string
  onApprove: (finalSpecs: Record<string, string>) => void
  onReject: () => void
  isApproving: boolean
}) {
  const catKey = (item.category ?? 'general') as CategoryKey
  const fields = CATEGORY_FIELDS[catKey] ?? []
  const origSpecs: Record<string, string> = {
    ...(item.item_specs ?? {}),
    ...(item.dimensions ? { dimensions: item.dimensions } : {}),
    ...(item.colour_finish ? { colour_finish: item.colour_finish } : {}),
  }
  const pendingSpecs: Record<string, string> = assignment.pending_supplier_specs ?? {}
  const response = assignment.response

  const allKeys = [...new Set([...Object.keys(origSpecs), ...Object.keys(pendingSpecs)])]
  const changedKeys = allKeys.filter(k => (pendingSpecs[k] ?? '') !== (origSpecs[k] ?? '') && (pendingSpecs[k] ?? '') !== '')

  function getLabel(key: string) {
    const def = fields.find(f => f.key === key)
    if (def) return def.label + (def.unit ? ` (${def.unit})` : '')
    return key.replace(/_/g, ' ')
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #FDE68A' }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
        <p className="text-[11px] font-semibold text-amber-800">
          {supplierName} changed {changedKeys.length} spec{changedKeys.length !== 1 ? 's' : ''} — accept or decline below
        </p>
      </div>

      {/* Price summary */}
      {response && (
        <div className="px-3 py-2.5 bg-white flex items-center gap-5" style={{ borderBottom: '1px solid #FEF9EC' }}>
          <div>
            <p className="text-[10px] text-[#8A877F] mb-0.5">Their price</p>
            <p className="text-sm font-bold text-[#2C2C2A]">R{response.unit_price.toLocaleString()}</p>
          </div>
          {response.lead_time_weeks && (
            <div>
              <p className="text-[10px] text-[#8A877F] mb-0.5">Lead time</p>
              <p className="text-sm font-medium text-[#2C2C2A]">{response.lead_time_weeks}w</p>
            </div>
          )}
          {response.notes && (
            <p className="text-xs text-[#8A877F] italic flex-1">{response.notes}</p>
          )}
        </div>
      )}

      {/* Read-only spec comparison */}
      {changedKeys.length > 0 && (
        <div className="p-3 bg-white">
          <div className="grid grid-cols-3 gap-x-3 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C4BFB5]">Spec</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C4BFB5]">Original</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Supplier&apos;s change</p>
          </div>
          {changedKeys.map(key => (
            <div key={key} className="grid grid-cols-3 gap-x-3 py-1.5 border-t border-[#F5F2EC]">
              <p className="text-xs text-[#8A877F]">{getLabel(key)}</p>
              <p className="text-xs text-[#8A877F] line-through">{origSpecs[key] || '—'}</p>
              <p className="text-xs font-medium text-amber-700">{pendingSpecs[key] || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end px-3 py-2" style={{ background: '#FFFBEB', borderTop: '1px solid #FDE68A' }}>
        <button type="button" onClick={onReject} disabled={isApproving}
          className="px-3 py-1 text-xs rounded-lg border border-[#D4CFC7] text-[#71717A] hover:bg-[#F5F2EC] transition-colors disabled:opacity-50">
          Decline
        </button>
        <button type="button" onClick={() => onApprove(pendingSpecs)} disabled={isApproving}
          className="px-3 py-1 text-xs font-semibold rounded-lg text-white disabled:opacity-50 transition-opacity"
          style={{ background: '#22C55E' }}>
          {isApproving ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </div>
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

// Build a human-readable dimensions string from item_specs for structured categories
function buildDimensionsFromSpecs(item: SessionItem): string | null {
  const s = item.item_specs
  if (!s) return item.dimensions ?? null

  // Furniture: overall_width × overall_height × overall_depth
  const w = s.overall_width, h = s.overall_height, d = s.overall_depth
  if (w || h || d) {
    return [w && `W: ${w}mm`, h && `H: ${h}mm`, d && `D: ${d}mm`].filter(Boolean).join(' × ')
  }
  // Stone/glass, lighting, flooring: generic width/height or diameter
  if (s.width || s.height || s.length) {
    return [s.width && `W: ${s.width}mm`, s.height && `H: ${s.height}mm`, s.length && `L: ${s.length}mm`, s.thickness && `T: ${s.thickness}mm`].filter(Boolean).join(' × ')
  }
  if (s.diameter) return `Ø ${s.diameter}mm${s.height ? ` × H: ${s.height}mm` : ''}`

  return item.dimensions ?? null
}

// Extract colour/finish from item_specs
function buildColourFromSpecs(item: SessionItem): string | null {
  if (item.colour_finish) return item.colour_finish
  const s = item.item_specs
  if (!s) return null
  return s.colour_stain ?? s.finish ?? null
}

// Build description text — excludes dimensions, colour, and supplier (those go to dedicated fields)
function buildPushDescription(item: SessionItem, response: Response): string {
  const parts: string[] = []
  if (item.work_type) parts.push(item.work_type)
  if (item.item_specs) {
    // Exclude fields already captured in dimensions/colour
    const skipKeys = new Set(['overall_width', 'overall_height', 'overall_depth', 'width', 'height', 'length', 'thickness', 'diameter', 'colour_stain', 'finish'])
    Object.entries(item.item_specs).forEach(([k, v]) => {
      if (v && !skipKeys.has(k)) parts.push(`${k.replace(/_/g, ' ')}: ${v}`)
    })
  }
  if (item.specifications) parts.push(item.specifications)
  if (response.lead_time_weeks) parts.push(`Lead time: ${response.lead_time_weeks} weeks`)
  if (response.notes && !response.notes.startsWith("[CAN'T SUPPLY]")) parts.push(`Note: ${response.notes}`)
  return parts.join(' | ')
}

function PushModal({ item, assignment, response, supplierName, projects, sessionId, sessionProjectId, onClose, onPushed }: PushModalProps) {
  const defaultProjectId = sessionProjectId && projects.some(p => p.id === sessionProjectId)
    ? sessionProjectId
    : ''
  const [projectId, setProjectId] = useState(defaultProjectId)
  const [markup, setMarkup] = useState('0')
  const [pushing, setPushing] = useState(false)

  const costPrice = response.unit_price
  const quantity = item.item_quantity ?? 1
  const markupNum = Number(markup) || 0
  const sellPrice = costPrice * (1 + markupNum / 100)
  const lineTotal = quantity * sellPrice

  const hasVariation = response.notes && !response.notes.startsWith("[CAN'T SUPPLY]")

  // Build read-only detail rows for confirmed info
  const detailRows: { label: string; value: string }[] = []
  if (item.item_quantity) detailRows.push({ label: 'Quantity', value: String(item.item_quantity) })
  if (item.dimensions) detailRows.push({ label: 'Dimensions', value: item.dimensions })
  if (item.colour_finish) detailRows.push({ label: 'Colour / Finish', value: item.colour_finish })
  if (item.work_type) detailRows.push({ label: 'Category', value: item.work_type })
  if (item.item_specs) {
    Object.entries(item.item_specs).forEach(([k, v]) => {
      if (v) detailRows.push({ label: k.replace(/_/g, ' '), value: v })
    })
  }
  if (item.specifications) detailRows.push({ label: 'Notes', value: item.specifications })

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
            description: buildPushDescription(item, response) || null,
            dimensions: buildDimensionsFromSpecs(item) ?? undefined,
            colour_finish: buildColourFromSpecs(item) ?? undefined,
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
            <h2 className="text-base font-bold text-[#2C2C2A]">Confirm & Push to Project</h2>
            <p className="text-xs text-[#8A877F] mt-0.5">Review the confirmed details, then select a project</p>
          </div>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Supplier notes / variations */}
          {hasVariation && (
            <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-0.5">Supplier note</p>
                <p className="text-sm text-amber-800 leading-relaxed">{response.notes}</p>
              </div>
            </div>
          )}

          {/* Item summary — read only */}
          <div className="bg-[#F5F2EC] rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Item</p>
            <p className="text-sm font-semibold text-[#2C2C2A] mb-2">{item.title}</p>
            {detailRows.map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-[#8A877F] capitalize">{row.label}</span>
                <span className="text-[#2C2C2A] text-right max-w-[60%]">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Supplier + cost summary — read only */}
          <div className="bg-[#F5F2EC] rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Accepted Price</p>
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
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_number ? `[${p.project_number}] ${p.project_name}` : p.project_name}</option>)}
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
            {pushing ? 'Pushing…' : 'Push to Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Comparison Matrix ----
function ComparisonTable({
  items, suppliers, onAccept, accepting, onOpenPush, pushedItems, projects, onApproveSpec,
}: {
  items: SessionItem[]
  suppliers: SessionSupplier[]
  onAccept: (itemId: string, assignmentId: string) => void
  accepting: string | null
  onOpenPush: (item: SessionItem, assignment: Assignment, response: Response, supplierName: string) => void
  pushedItems: Record<string, string>
  projects: Props['projects']
  onApproveSpec: (ssId: string, assignmentId: string, itemId: string, action: 'approve' | 'reject', finalSpecs?: Record<string, string>) => Promise<void>
}) {
  const [expandedSpecCell, setExpandedSpecCell] = useState<string | null>(null)
  const [approvingSpecMatrix, setApprovingSpecMatrix] = useState<string | null>(null)
  const assignedItems = items.filter(item =>
    suppliers.some(ss => ss.assignments.some(a => a.item_id === item.id))
  )
  if (assignedItems.length === 0) return null

  // Cheapest price per item (among suppliers who responded)
  const minPricePerItem: Record<string, number> = {}
  for (const item of assignedItems) {
    let min = Infinity
    for (const ss of suppliers) {
      const a = ss.assignments.find(a => a.item_id === item.id)
      if (a?.response && a.status !== 'supplier_declined') {
        min = Math.min(min, a.response.unit_price)
      }
    }
    if (min < Infinity) minPricePerItem[item.id] = min
  }

  // Total cost per supplier (sum of responded prices × qty)
  const supplierTotals: Record<string, number> = {}
  for (const ss of suppliers) {
    let total = 0
    for (const a of ss.assignments) {
      if (a.response && a.status !== 'supplier_declined') {
        const qty = items.find(i => i.id === a.item_id)?.item_quantity ?? 1
        total += a.response.unit_price * qty
      }
    }
    supplierTotals[ss.id] = total
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:     'bg-[#F5F2EC] text-[#8A877F]',
    sent:        'bg-blue-50 text-blue-600',
    viewed:      'bg-sky-50 text-sky-600',
    in_progress: 'bg-amber-50 text-amber-600',
    completed:   'bg-emerald-50 text-emerald-600',
    declined:    'bg-red-50 text-red-400',
  }

  return (
    <div className="bg-white border border-[#EDE9E1] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#EDE9E1]" style={{ background: '#FAFAF8' }}>
              <th className="px-5 py-4 text-left text-xs font-semibold text-[#8A877F] min-w-[180px] sticky left-0 bg-[#FAFAF8] z-10">Item</th>
              {suppliers.map(ss => {
                const effectiveStatus = ss.sent_at && ss.status === 'pending' ? 'sent' : ss.status
                const statusCls = STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS.pending
                return (
                  <th key={ss.id} className="px-5 py-4 text-left min-w-[170px]">
                    <p className="text-xs font-semibold text-[#2C2C2A] truncate">{ss.supplier_name}</p>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${statusCls}`}>
                      {effectiveStatus.replace('_', ' ')}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {assignedItems.map((item, rowIdx) => {
              const respondedCount = suppliers.filter(ss => {
                const a = ss.assignments.find(a => a.item_id === item.id)
                return a?.response && a.status !== 'supplier_declined'
              }).length
              const hasMultiple = respondedCount > 1

              return (
                <tr key={item.id} className={`border-b border-[#F5F2EC] last:border-0 ${rowIdx % 2 === 1 ? 'bg-[#FAFAF8]' : ''}`}>
                  <td className={`px-5 py-3.5 sticky left-0 z-10 ${rowIdx % 2 === 1 ? 'bg-[#FAFAF8]' : 'bg-white'}`}>
                    <div className="flex items-center gap-2">
                      {item.status === 'accepted' && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                      <div>
                        <p className="font-medium text-[#2C2C2A] text-sm">{item.title}</p>
                        {item.item_quantity && item.item_quantity > 1 && (
                          <p className="text-[10px] text-[#C4BFB5]">×{item.item_quantity}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {suppliers.map(ss => {
                    const assignment = ss.assignments.find(a => a.item_id === item.id)
                    const isAccepted = assignment?.status === 'accepted'
                    const isDeclined = assignment?.status === 'supplier_declined'
                    const specPending = assignment?.spec_approval_status === 'pending'
                    const hasResponse = !!assignment?.response && !isDeclined
                    const isCheapest = hasResponse && hasMultiple && assignment?.response?.unit_price === minPricePerItem[item.id]

                    if (!assignment) {
                      return <td key={ss.id} className="px-5 py-3.5 text-xs text-[#D4CFC7]">—</td>
                    }
                    if (isDeclined) {
                      return (
                        <td key={ss.id} className="px-5 py-3.5 bg-red-50">
                          <p className="text-xs font-medium text-red-500">Can&apos;t supply</p>
                          {assignment.response?.notes && (
                            <p className="text-[10px] text-red-300 mt-0.5 truncate max-w-[130px]" title={assignment.response.notes.replace("[CAN'T SUPPLY] ", '')}>
                              {assignment.response.notes.replace("[CAN'T SUPPLY] ", '')}
                            </p>
                          )}
                        </td>
                      )
                    }
                    if (specPending) {
                      const isExpanded = expandedSpecCell === assignment.id
                      return (
                        <td key={ss.id} className="px-5 py-3.5 bg-amber-50">
                          {assignment.response && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-[#2C2C2A]">R{assignment.response.unit_price.toLocaleString()}</span>
                              {assignment.response.lead_time_weeks && (
                                <span className="text-[10px] text-[#8A877F]">{assignment.response.lead_time_weeks}w lead</span>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedSpecCell(isExpanded ? null : assignment.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                          >
                            <AlertTriangle size={10} />
                            Specs changed — review {isExpanded ? '▲' : '▼'}
                          </button>
                          {isExpanded && (
                            <div className="mt-2" style={{ minWidth: 280 }}>
                              <SpecApprovalPanel
                                item={item}
                                assignment={assignment}
                                supplierName={ss.supplier_name}
                                isApproving={approvingSpecMatrix === assignment.id}
                                onApprove={async (finalSpecs) => {
                                  setApprovingSpecMatrix(assignment.id)
                                  await onApproveSpec(ss.id, assignment.id, item.id, 'approve', finalSpecs)
                                  setApprovingSpecMatrix(null)
                                  setExpandedSpecCell(null)
                                }}
                                onReject={async () => {
                                  setApprovingSpecMatrix(assignment.id)
                                  await onApproveSpec(ss.id, assignment.id, item.id, 'reject')
                                  setApprovingSpecMatrix(null)
                                  setExpandedSpecCell(null)
                                }}
                              />
                            </div>
                          )}
                        </td>
                      )
                    }
                    if (!hasResponse) {
                      return <td key={ss.id} className="px-5 py-3.5 text-xs text-[#D4CFC7]">—</td>
                    }

                    const response = assignment.response!
                    return (
                      <td key={ss.id} className="px-5 py-3.5" style={{ background: isAccepted ? '#F0FDF4' : isCheapest ? '#F6FFED' : undefined }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#2C2C2A]">R{response.unit_price.toLocaleString()}</span>
                            {isCheapest && !isAccepted && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Lowest</span>
                            )}
                            {isAccepted && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                          </div>
                          {response.lead_time_weeks && (
                            <p className="text-[10px] text-[#8A877F] mt-0.5">{response.lead_time_weeks}w lead</p>
                          )}
                          {response.notes && !response.notes.startsWith("[CAN'T SUPPLY]") && (
                            <p className="text-[10px] text-amber-600 mt-0.5 truncate max-w-[130px]" title={response.notes}>
                              ⚠ {response.notes}
                            </p>
                          )}
                          <div className="mt-2">
                            {isAccepted ? (
                              pushedItems[item.id] ? (
                                <a href={`/projects/${pushedItems[item.id]}`}
                                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2 transition-colors">
                                  On Quote — {projects.find(p => p.id === pushedItems[item.id])?.project_name ?? 'View project'} ↗
                                </a>
                              ) : (
                                <button
                                  onClick={() => onOpenPush(item, assignment, response, ss.supplier_name)}
                                  className="text-[10px] text-[#C4A46B] hover:text-[#9A7B4F] font-medium transition-colors">
                                  Add to Project Quote →
                                </button>
                              )
                            ) : (
                              item.status !== 'accepted' && (
                                <button
                                  onClick={() => onAccept(item.id, assignment.id)}
                                  disabled={accepting === assignment.id}
                                  className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                  {accepting === assignment.id ? '…' : 'Select'}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#EDE9E1]" style={{ background: '#FAFAF8' }}>
              <td className="px-5 py-3 text-xs font-semibold text-[#8A877F] sticky left-0 bg-[#FAFAF8] z-10">Total (responded)</td>
              {suppliers.map(ss => (
                <td key={ss.id} className="px-5 py-3">
                  {supplierTotals[ss.id] > 0 ? (
                    <span className="text-sm font-bold text-[#2C2C2A]">R{supplierTotals[ss.id].toLocaleString()}</span>
                  ) : (
                    <span className="text-xs text-[#D4CFC7]">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---- Supplier Card ----
function SupplierCard({
  ss, items, sessionId, sessionStatus,
  onAssignToggle, onAccept, onOpenPush, onRemove, onSend, onSpecAction, pushedItems, projects,
}: {
  ss: SessionSupplier
  items: SessionItem[]
  sessionId: string
  sessionStatus: string
  onAssignToggle: (ssId: string, itemId: string, assigned: boolean) => void
  onAccept: (itemId: string, assignmentId: string) => void
  onOpenPush: (item: SessionItem, assignment: Assignment, response: Response, supplierName: string) => void
  onRemove: (ssId: string) => void
  onSend: (ssId: string) => Promise<void>
  onSpecAction: (ssId: string, assignmentId: string, status: 'approved' | 'rejected') => void
  pushedItems: Record<string, string>
  projects: Props['projects']
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAddItems, setShowAddItems] = useState(false)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [approvingSpec, setApprovingSpec] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const assignedItemIds = new Set(ss.assignments.map(a => a.item_id))
  const assignedItems = items.filter(item => assignedItemIds.has(item.id))
  const unassignedItems = items.filter(item => !assignedItemIds.has(item.id))
  const isDraft = sessionStatus === 'draft'
  const isArchived = ss.status === 'declined'
  const allAccepted = ss.assignments.length > 0 && ss.assignments.every(a => a.status === 'accepted')
  const respondedCount = ss.assignments.filter(a => a.status === 'responded').length
  const specApprovalPendingCount = ss.assignments.filter(a => a.spec_approval_status === 'pending').length

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

  async function handleApproveSpec(assignmentId: string, itemId: string, action: 'approve' | 'reject', finalSpecs?: Record<string, string>) {
    setApprovingSpec(assignmentId)
    try {
      const res = await fetch(`/api/sourcing/sessions/${sessionId}/assignments/${assignmentId}/approve-specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(finalSpecs ? { final_specs: finalSpecs } : {}) }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onSpecAction(ss.id, assignmentId, action === 'approve' ? 'approved' : 'rejected')
      if (action === 'approve') {
        onAccept(itemId, assignmentId)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setApprovingSpec(null)
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
            {respondedCount > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setExpanded(true) }}
                title={`${respondedCount} item${respondedCount !== 1 ? 's' : ''} replied`}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#FFFBEB', color: '#92600A', border: '1px solid #FDE68A' }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#F59E0B' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#F59E0B' }} />
                </span>
                {respondedCount} {respondedCount === 1 ? 'reply' : 'replies'}
              </button>
            )}
            {specApprovalPendingCount > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setExpanded(true) }}
                title={`${specApprovalPendingCount} spec change${specApprovalPendingCount !== 1 ? 's' : ''} awaiting approval`}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}
              >
                ⚠ {specApprovalPendingCount} spec approval{specApprovalPendingCount !== 1 ? 's' : ''} pending
              </button>
            )}
          </div>
          <p className="text-xs text-[#8A877F] mt-0.5">{ss.email} · {assignedItems.length} item{assignedItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Resend — only shown when new items were assigned after the last send */}
          {!isDraft && ss.sent_at && ss.assignments.some(a => a.created_at && a.created_at > ss.sent_at!) && (
            <button
              type="button"
              onClick={async e => { e.stopPropagation(); setSending(true); await onSend(ss.id); setSending(false) }}
              disabled={sending}
              title="Resend — new items added since last send"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border disabled:opacity-40 transition-colors"
              style={{ background: 'transparent', border: '1px solid #C4A46B', color: '#9A7B4F' }}
            >
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {sending ? 'Sending…' : 'Resend'}
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
                const specStatus = assignment?.spec_approval_status ?? null

                const hasSpecChanges = (() => {
                  const supp = assignment?.response?.supplier_specs
                  if (!supp) return false
                  const orig: Record<string, string> = item.item_specs ?? {}
                  return Object.keys({ ...orig, ...supp }).some(k => (supp[k] ?? '') !== (orig[k] ?? ''))
                })()

                return (
                  <div key={item.id} className="py-2 border-b border-[#F5F2EC] last:border-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {isAccepted && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                      <p className="text-sm font-medium text-[#2C2C2A]">{item.title}</p>
                      {item.item_quantity && <span className="text-xs text-[#C4BFB5]">×{item.item_quantity}</span>}
                      {isAccepted && <span className="text-xs text-emerald-600 font-medium">Selected</span>}
                      {specStatus === 'pending' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
                          Spec approval pending
                        </span>
                      )}
                      {specStatus === 'approved' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                          Specs approved
                        </span>
                      )}
                      {specStatus === 'rejected' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FFF1F2', color: '#9F1239', border: '1px solid #FECDD3' }}>
                          Specs rejected
                        </span>
                      )}
                      {!specStatus && hasSpecChanges && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
                          Spec changes
                        </span>
                      )}
                    </div>

                    {/* Editable spec approval panel — all fields, supplier changes highlighted */}
                    {specStatus === 'pending' && assignment && (
                      <SpecApprovalPanel
                        item={item}
                        assignment={assignment}
                        supplierName={ss.supplier_name}
                        isApproving={approvingSpec === assignment.id}
                        onApprove={finalSpecs => handleApproveSpec(assignment.id, item.id, 'approve', finalSpecs)}
                        onReject={() => handleApproveSpec(assignment.id, item.id, 'reject')}
                      />
                    )}


                    {hasResponse && assignment?.response && specStatus !== 'pending' && (
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
                            Select
                          </button>
                        )}
                        {isAccepted && assignment?.response && (
                          pushedItems[item.id] ? (
                            <a
                              href={`/projects/${pushedItems[item.id]}`}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors underline underline-offset-2"
                            >
                              On Quote — {projects.find(p => p.id === pushedItems[item.id])?.project_name ?? 'View project'} ↗
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenPush(item, assignment, assignment.response!, ss.supplier_name)}
                              className="text-xs text-[#C4A46B] hover:text-[#9A7B4F] font-medium transition-colors"
                            >
                              Add to Project Quote →
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {!hasResponse && !isAccepted && (() => {
                      if (isDraft) return <p className="text-xs text-[#C4BFB5] mt-1">Assigned — not sent yet</p>
                      const isNewlyAssigned = ss.sent_at && assignment?.created_at && assignment.created_at > ss.sent_at
                      return isNewlyAssigned
                        ? <p className="text-xs text-amber-500 mt-1 font-medium">New — resend to notify supplier</p>
                        : <p className="text-xs text-[#C4BFB5] mt-1">Awaiting response</p>
                    })()}
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

    </div>
  )
}

// ---- Progress Rail ----
function ProgressRail({ itemsDone, suppliersDone, assignDone }: { itemsDone: boolean; suppliersDone: boolean; assignDone: boolean }) {
  const steps = [
    { label: 'Add items',            done: itemsDone },
    { label: 'Add suppliers',        done: suppliersDone },
    { label: 'Assign items',         done: assignDone },
    { label: 'Send to suppliers',    done: false },
  ]
  const stepEls: React.ReactNode[] = []
  steps.forEach((step, i) => {
    const prevDone = i === 0 || steps[i - 1].done
    const isCurrent = !step.done && prevDone
    stepEls.push(
      <div key={`step-${i}`} className="flex items-center gap-2 shrink-0">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
          step.done ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-[#2C2C2A] text-[#F5F2EC]' : 'bg-[#EDE9E1] text-[#A89F91]'
        }`}>
          {step.done ? <Check size={10} /> : i + 1}
        </div>
        <span className={`text-xs transition-colors ${
          step.done ? 'text-[#A89F91] line-through' : isCurrent ? 'text-[#2C2C2A] font-semibold' : 'text-[#C4BFB5]'
        }`}>{step.label}</span>
      </div>
    )
    if (i < steps.length - 1) {
      stepEls.push(
        <div key={`conn-${i}`} className="flex-1 h-px mx-2" style={{ background: steps[i].done ? '#A7F3D0' : '#EDE9E1' }} />
      )
    }
  })
  return (
    <div className="flex items-center bg-white border border-[#EDE9E1] rounded-xl px-5 py-3">
      {stepEls}
    </div>
  )
}

// ---- Main Component ----
export function SourcingDetail({ session, initialItems, initialSuppliers, allSuppliers, projects }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState<SessionItem[]>(initialItems)
  const [suppliers, setSuppliers] = useState<SessionSupplier[]>(initialSuppliers)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [pushModal, setPushModal] = useState<{
    item: SessionItem; assignment: Assignment; response: Response; supplierName: string
  } | null>(null)
  const [addingSupplier, setAddingSupplier] = useState(false)
  // keyed by item.id → project_id that was pushed to
  const [pushedItems, setPushedItems] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const item of initialItems) {
      if ((item as any).pushed_to_project_id) map[item.id] = (item as any).pushed_to_project_id
    }
    return map
  })

  // Tab: auto-open Compare if there are already responses
  const [tab, setTab] = useState<'request' | 'compare'>(() =>
    initialSuppliers.some(ss => ss.assignments.some(a => a.response !== null || a.status === 'supplier_declined'))
      ? 'compare'
      : 'request'
  )

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
          created_at: new Date().toISOString(),
          pending_supplier_specs: null,
          spec_approval_status: null,
          spec_approved_at: null,
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

  function handleSpecAction(ssId: string, assignmentId: string, status: 'approved' | 'rejected') {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== ssId) return s
      return {
        ...s,
        assignments: s.assignments.map(a => {
          if (a.id !== assignmentId) return a
          return {
            ...a,
            spec_approval_status: status,
            ...(status === 'rejected' ? { pending_supplier_specs: null } : {}),
            ...(status === 'approved' ? { spec_approved_at: new Date().toISOString() } : {}),
          }
        }),
      }
    }))
  }

  function handlePushToProject(projectId: string) {
    if (pushModal) {
      setPushedItems(prev => ({ ...prev, [pushModal.item.id]: projectId }))
    }
    startTransition(() => router.refresh())
  }

  async function handleApproveSpecFromMatrix(ssId: string, assignmentId: string, itemId: string, action: 'approve' | 'reject', finalSpecs?: Record<string, string>) {
    const ss = suppliers.find(s => s.id === ssId)
    const sessionSupplierId = ss?.id
    if (!sessionSupplierId) return
    const res = await fetch(`/api/sourcing/sessions/${session.id}/assignments/${assignmentId}/approve-specs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(finalSpecs ? { final_specs: finalSpecs } : {}) }),
    })
    if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
    handleSpecAction(ssId, assignmentId, action === 'approve' ? 'approved' : 'rejected')
    if (action === 'approve') {
      handleAccept(itemId, assignmentId)
    }
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
      const res = await fetch(`/api/sourcing/sessions/${session.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      startTransition(() => router.refresh())
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  async function handleSendToSupplier(ssId: string) {
    try {
      const res = await fetch(`/api/sourcing/sessions/${session.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_supplier_id: ssId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const now = new Date().toISOString()
      setSuppliers(prev => prev.map(s =>
        s.id === ssId ? { ...s, sent_at: now, status: 'sent' } : s
      ))
      startTransition(() => router.refresh())
    } catch (err: any) {
      alert(err.message)
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

      {/* Tab switcher */}
      {(() => {
        const hasAnyResponse = suppliers.some(ss => ss.assignments.some(a => a.response !== null || a.status === 'supplier_declined'))
        return (
          <>
            <div className="flex border-b border-[#EDE9E1]">
              <button
                onClick={() => setTab('request')}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'request' ? 'border-[#2C2C2A] text-[#2C2C2A]' : 'border-transparent text-[#8A877F] hover:text-[#2C2C2A]'}`}
              >
                Request
                {items.length > 0 && <span className="ml-1.5 text-xs text-[#C4BFB5]">{items.length}</span>}
              </button>
              <button
                onClick={() => setTab('compare')}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${tab === 'compare' ? 'border-[#2C2C2A] text-[#2C2C2A]' : 'border-transparent text-[#8A877F] hover:text-[#2C2C2A]'}`}
              >
                Compare
                {hasAnyResponse && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 inline-block" />}
              </button>
            </div>

            {/* REQUEST TAB */}
            {tab === 'request' && (
              <>
                {isDraft && (
                  <ProgressRail
                    itemsDone={items.length > 0}
                    suppliersDone={suppliers.length > 0}
                    assignDone={suppliers.some(ss => ss.assignments.length > 0)}
                  />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Items */}
                  <div className="space-y-3">
                    <div>
                      {isDraft && <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4A46B] mb-0.5">Step 1</p>}
                      <h2 className="text-sm font-semibold text-[#2C2C2A]">Items ({items.length})</h2>
                    </div>
                    {items.length === 0 ? (
                      <div className="border border-dashed border-[#D4CFC7] rounded-xl p-6 text-center">
                        <p className="text-xs text-[#8A877F]">Add items to request prices for.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map(item => {
                          const isExpanded = expandedItemId === item.id
                          const catKey = (item.category ?? 'general') as CategoryKey
                          const fieldDefs = CATEGORY_FIELDS[catKey] ?? []
                          const catLabel = CATEGORIES.find(c => c.key === catKey)?.label
                          return (
                            <div key={item.id} className="bg-white border border-[#EDE9E1] rounded-xl overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAF8] transition-colors"
                              >
                                {item.ref_image_urls && item.ref_image_urls.length > 0 && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.ref_image_urls[0]} alt={item.title} className="w-10 h-10 object-cover rounded-lg border border-[#EDE9E1] shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {item.status === 'accepted' && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                                    <p className="text-sm font-medium text-[#2C2C2A] truncate">{item.title}</p>
                                    {item.category && item.category !== 'general' && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#F5F2EC] text-[#8A877F] border border-[#EDE9E1] shrink-0 capitalize">
                                        {catLabel ?? item.category}
                                      </span>
                                    )}
                                    {item.status === 'accepted' && (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">accepted</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#8A877F] mt-0.5">
                                    {item.category === 'general'
                                      ? [item.work_type, item.item_quantity ? `Qty ${item.item_quantity}` : null, item.dimensions, item.colour_finish].filter(Boolean).join(' · ')
                                      : [item.item_quantity ? `Qty ${item.item_quantity}` : null, item.item_specs ? `${Object.keys(item.item_specs).length} specs` : null].filter(Boolean).join(' · ')
                                    }
                                  </p>
                                </div>
                                {isExpanded ? <ChevronUp size={13} className="text-[#8A877F] shrink-0" /> : <ChevronDown size={13} className="text-[#8A877F] shrink-0" />}
                              </button>

                              {isExpanded && (
                                <div className="border-t border-[#EDE9E1] px-4 py-3 space-y-3" style={{ background: '#FAFAF8' }}>
                                  {item.ref_image_urls && item.ref_image_urls.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                      {item.ref_image_urls.map((url, i) => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-[#EDE9E1]" />
                                      ))}
                                    </div>
                                  )}
                                  {item.item_specs && Object.keys(item.item_specs).length > 0 && (
                                    <div>
                                      {catLabel && catKey !== 'general' && (
                                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#A89F91' }}>{catLabel}</p>
                                      )}
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                        {Object.entries(item.item_specs).map(([key, val]) => {
                                          const def = fieldDefs.find(f => f.key === key)
                                          const label = def?.label ?? key.replace(/_/g, ' ')
                                          const display = def?.unit ? `${val} ${def.unit}` : val
                                          return (
                                            <div key={key} className="flex gap-1 items-baseline">
                                              <span className="text-xs text-[#8A877F] shrink-0">{label}:</span>
                                              <span className="text-xs text-[#2C2C2A] font-medium">{display}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {(item.dimensions || item.colour_finish) && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                      {item.dimensions && (
                                        <div className="flex gap-1 items-baseline">
                                          <span className="text-xs text-[#8A877F] shrink-0">Dimensions:</span>
                                          <span className="text-xs text-[#2C2C2A] font-medium">{item.dimensions}</span>
                                        </div>
                                      )}
                                      {item.colour_finish && (
                                        <div className="flex gap-1 items-baseline">
                                          <span className="text-xs text-[#8A877F] shrink-0">Colour:</span>
                                          <span className="text-xs text-[#2C2C2A] font-medium">{item.colour_finish}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {item.specifications && (
                                    <p className="text-xs text-[#8A877F] leading-relaxed">{item.specifications}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {!isArchived && <AddItemForm sessionId={session.id} onAdded={handleItemAdded} sortOrder={items.length} />}
                  </div>

                  {/* Right: Suppliers */}
                  <div className="space-y-3">
                    <div>
                      {isDraft && <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4A46B] mb-0.5">Step 2</p>}
                      <h2 className="text-sm font-semibold text-[#2C2C2A]">Suppliers ({suppliers.length})</h2>
                    </div>
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
                            onSend={handleSendToSupplier}
                            onSpecAction={handleSpecAction}
                            pushedItems={pushedItems}
                            projects={projects}
                          />
                        ))}
                      </div>
                    )}
                    {isDraft && suppliers.length > 0 && !suppliers.some(ss => ss.assignments.length > 0) && (
                      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700">Open the supplier above and assign at least one item before sending.</p>
                      </div>
                    )}
                    {!isArchived && (
                      addingSupplier ? (
                        <AddSupplierForm
                          sessionId={session.id}
                          allSuppliers={allSuppliers}
                          existingEmails={suppliers.map(s => s.email)}
                          onAdded={ss => { handleSupplierAdded(ss); setAddingSupplier(false) }}
                          onClose={() => setAddingSupplier(false)}
                          items={items}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingSupplier(true)}
                          className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                        >
                          <Plus size={14} /> Add Supplier
                        </button>
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {/* COMPARE TAB */}
            {tab === 'compare' && (
              hasAnyResponse ? (
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
                  onApproveSpec={handleApproveSpecFromMatrix}
                />
              ) : (
                <div className="border border-dashed border-[#D4CFC7] rounded-xl p-12 text-center">
                  <BarChart3 size={24} className="text-[#D4CFC7] mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#8A877F]">Waiting for supplier responses</p>
                  <p className="text-xs text-[#C4BFB5] mt-1">Once suppliers submit prices, they&apos;ll appear here side by side.</p>
                </div>
              )
            )}
          </>
        )
      })()}
    </div>
  )
}
