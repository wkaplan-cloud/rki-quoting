'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Pencil, Trash2, ImagePlus, Tag, ArrowRight,
  Loader2, ChevronLeft, ChevronRight, LayoutGrid, PackageOpen,
} from 'lucide-react'

interface Piece {
  id: string
  name: string
  description: string | null
  work_type: string | null
  dimensions: string | null
  colour_finish: string | null
  year: number | null
  supplier_id: string | null
  supplier_name: string | null
  base_price: number | null
  image_urls: string[]
  created_at: string
}

interface Props {
  initialPieces: Piece[]
  suppliers: { id: string; supplier_name: string }[]
  projects: { id: string; project_name: string }[]
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#C4A46B] bg-white'
const LABEL = 'block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1'

// ---- Image Lightbox ----
function ImageLightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex)
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute left-4 text-white/70 hover:text-white transition-colors" onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length) }}>
        <ChevronLeft size={36} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[idx]} alt="" className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
      <button className="absolute right-4 text-white/70 hover:text-white transition-colors" onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length) }}>
        <ChevronRight size={36} />
      </button>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={onClose}>
        <X size={22} />
      </button>
      {urls.length > 1 && (
        <p className="absolute bottom-4 text-white/50 text-sm">{idx + 1} / {urls.length}</p>
      )}
    </div>
  )
}

// ---- Add/Edit Piece Modal ----
function PieceModal({
  piece,
  suppliers,
  onClose,
  onSaved,
}: {
  piece: Piece | null
  suppliers: Props['suppliers']
  onClose: () => void
  onSaved: (p: Piece) => void
}) {
  const isEdit = !!piece
  const [name, setName] = useState(piece?.name ?? '')
  const [description, setDescription] = useState(piece?.description ?? '')
  const [workType, setWorkType] = useState(piece?.work_type ?? '')
  const [dimensions, setDimensions] = useState(piece?.dimensions ?? '')
  const [colourFinish, setColourFinish] = useState(piece?.colour_finish ?? '')
  const [year, setYear] = useState(piece?.year?.toString() ?? '')
  const [supplierId, setSupplierId] = useState(piece?.supplier_id ?? '')
  const [supplierName, setSupplierName] = useState(piece?.supplier_name ?? '')
  const [basePrice, setBasePrice] = useState(piece?.base_price?.toString() ?? '')
  const [imageUrls, setImageUrls] = useState<string[]>(piece?.image_urls ?? [])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSupplierSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = suppliers.find(s => s.id === e.target.value)
    setSupplierId(s?.id ?? '')
    setSupplierName(s?.supplier_name ?? '')
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setNewFiles(prev => [...prev, ...files].slice(0, 10 - imageUrls.length))
    e.target.value = ''
  }

  async function uploadNewImages(pieceId: string): Promise<string[]> {
    if (!newFiles.length) return []
    setUploadingImages(true)
    try {
      const formData = new FormData()
      newFiles.forEach(f => formData.append('files', f))
      const res = await fetch(`/api/pieces/${pieceId}/images`, { method: 'POST', body: formData })
      const json = await res.json()
      return json.all_urls ?? imageUrls
    } finally {
      setUploadingImages(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        work_type: workType.trim() || null,
        dimensions: dimensions.trim() || null,
        colour_finish: colourFinish.trim() || null,
        year: year ? Number(year) : null,
        supplier_id: supplierId || null,
        supplier_name: supplierId ? supplierName : (supplierName.trim() || null),
        base_price: basePrice ? Number(basePrice) : null,
      }

      let savedPiece: Piece
      if (isEdit) {
        const res = await fetch(`/api/pieces/${piece!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        savedPiece = json.data

        // Upload new images if any
        if (newFiles.length > 0) {
          const allUrls = await uploadNewImages(piece!.id)
          savedPiece = { ...savedPiece, image_urls: allUrls }
        }
      } else {
        const res = await fetch('/api/pieces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        savedPiece = json.data

        // Upload images right after create
        if (newFiles.length > 0) {
          const allUrls = await uploadNewImages(savedPiece.id)
          savedPiece = { ...savedPiece, image_urls: allUrls }
        }
      }

      onSaved(savedPiece)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EDE9E1]">
          <h2 className="text-base font-bold text-[#2C2C2A]">{isEdit ? 'Edit piece' : 'Add new piece'}</h2>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className={LABEL}>Name <span className="text-red-400 normal-case tracking-normal">*</span></label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} required className={INPUT} placeholder="e.g. Barcelona Chair" />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${INPUT} resize-none`} placeholder="Materials, details, notes…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Category</label>
              <input value={workType} onChange={e => setWorkType(e.target.value)} className={INPUT} placeholder="e.g. Seating" />
            </div>
            <div>
              <label className={LABEL}>Year</label>
              <input type="number" min="1900" max="2099" value={year} onChange={e => setYear(e.target.value)} className={INPUT} placeholder="e.g. 2023" />
            </div>
            <div>
              <label className={LABEL}>Dimensions</label>
              <input value={dimensions} onChange={e => setDimensions(e.target.value)} className={INPUT} placeholder="W × D × H" />
            </div>
            <div>
              <label className={LABEL}>Colour / Finish</label>
              <input value={colourFinish} onChange={e => setColourFinish(e.target.value)} className={INPUT} placeholder="e.g. Brushed brass" />
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className={LABEL}>Supplier (optional)</label>
            <select value={supplierId} onChange={handleSupplierSelect} className={INPUT}>
              <option value="">No supplier selected</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
            </select>
          </div>

          {/* Base price */}
          <div>
            <label className={LABEL}>Reference price (cost excl. VAT)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A877F]">R</span>
              <input type="number" min="0" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)}
                className={`${INPUT} pl-7`} placeholder="0.00" />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className={LABEL}>Images (up to 10)</label>
            <div className="flex gap-2 flex-wrap">
              {/* Existing images */}
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-[#EDE9E1]" />
                  <button type="button"
                    onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
              {/* New file previews */}
              {newFiles.map((f, i) => (
                <div key={`new-${i}`} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt={f.name} className="w-16 h-16 object-cover rounded-lg border border-[#C4A46B]" />
                  <button type="button"
                    onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
              {/* Add button */}
              {imageUrls.length + newFiles.length < 10 && (
                <label className="w-16 h-16 border-2 border-dashed border-[#D4CFC7] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#C4A46B] transition-colors">
                  <ImagePlus size={18} className="text-[#8A877F]" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm text-[#8A877F] border border-[#D4CFC7] rounded-xl hover:border-[#8A877F] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploadingImages || !name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              style={{ background: '#2C2C2A', color: '#F5F2EC' }}>
              {(saving || uploadingImages) ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : uploadingImages ? 'Uploading…' : isEdit ? 'Save changes' : 'Add piece'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Add to Quote Modal ----
function AddToQuoteModal({
  piece,
  projects,
  onClose,
  onDone,
}: {
  piece: Piece
  projects: Props['projects']
  onClose: () => void
  onDone: () => void
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [markup, setMarkup] = useState('0')
  const [quantity, setQuantity] = useState('1')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const costPrice = piece.base_price ?? 0
  const markupNum = Number(markup) || 0
  const qty = Number(quantity) || 1
  const sellPrice = costPrice * (1 + markupNum / 100)
  const lineTotal = qty * sellPrice

  async function handleAdd() {
    if (!projectId) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/pieces/${piece.id}/add-to-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, markup_percentage: markupNum, quantity: qty }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onDone()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#EDE9E1]">
          <div>
            <h2 className="text-base font-bold text-[#2C2C2A]">Add to quote</h2>
            <p className="text-xs text-[#8A877F] mt-0.5">{piece.name}</p>
          </div>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {projects.length === 0 ? (
            <p className="text-sm text-[#8A877F]">No projects found. Create a project first.</p>
          ) : (
            <>
              <div>
                <label className={LABEL}>Project</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className={INPUT}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Quantity</label>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Markup %</label>
                  <input type="number" min="0" max="500" value={markup} onChange={e => setMarkup(e.target.value)} className={INPUT} />
                </div>
              </div>

              {/* Price summary */}
              <div className="bg-[#F5F2EC] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A877F]">Cost price</span>
                  <span className="font-medium text-[#2C2C2A]">
                    {costPrice > 0 ? `R${costPrice.toLocaleString()}` : 'No reference price set'}
                  </span>
                </div>
                {costPrice > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8A877F]">Sell price (per unit)</span>
                      <span className="font-medium text-[#2C2C2A]">R{sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-[#D4CFC7] pt-2">
                      <span className="text-[#8A877F]">Line total (×{qty})</span>
                      <span className="font-bold text-[#2C2C2A]">R{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-[#8A877F] border border-[#D4CFC7] rounded-xl hover:border-[#8A877F] transition-colors">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={adding || !projectId}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              style={{ background: '#2C2C2A', color: '#F5F2EC' }}>
              {adding ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {adding ? 'Adding…' : 'Add to quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Piece Card ----
function PieceCard({
  piece,
  onEdit,
  onDelete,
  onAddToQuote,
  onSendForPricing,
}: {
  piece: Piece
  onEdit: () => void
  onDelete: () => void
  onAddToQuote: () => void
  onSendForPricing: () => void
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const mainImage = piece.image_urls?.[0]

  return (
    <div className="bg-white border border-[#EDE9E1] rounded-2xl overflow-hidden flex flex-col group hover:shadow-md transition-shadow duration-200">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-[#F5F2EC] overflow-hidden">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainImage}
            alt={piece.name}
            className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
            onClick={() => setLightboxIdx(0)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PackageOpen size={28} className="text-[#C4BFB5]" />
          </div>
        )}

        {/* Image count badge */}
        {piece.image_urls.length > 1 && (
          <button
            onClick={() => setLightboxIdx(0)}
            className="absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#FFFFFF' }}
          >
            +{piece.image_urls.length - 1}
          </button>
        )}

        {/* Action buttons — top right overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit}
            className="w-7 h-7 bg-white rounded-lg shadow flex items-center justify-center text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 bg-white rounded-lg shadow flex items-center justify-center text-[#8A877F] hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-2">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm text-[#2C2C2A] leading-snug">{piece.name}</p>
            {piece.year && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-[#F5F2EC] text-[#8A877F]">{piece.year}</span>
            )}
          </div>
          {piece.work_type && <p className="text-xs text-[#8A877F] mt-0.5">{piece.work_type}</p>}
        </div>

        {piece.description && (
          <p className="text-xs text-[#8A877F] leading-relaxed line-clamp-2">{piece.description}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto">
          {piece.dimensions && <span className="text-[11px] text-[#C4BFB5]">{piece.dimensions}</span>}
          {piece.colour_finish && <span className="text-[11px] text-[#C4BFB5]">{piece.colour_finish}</span>}
        </div>

        {/* Supplier + price row */}
        <div className="flex items-center justify-between pt-1 border-t border-[#F5F2EC]">
          <p className="text-xs text-[#8A877F] truncate">
            {piece.supplier_name ?? <span className="text-[#C4BFB5]">No supplier</span>}
          </p>
          {piece.base_price != null && (
            <p className="text-xs font-semibold text-[#2C2C2A] shrink-0 ml-2">R{piece.base_price.toLocaleString()}</p>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex gap-2 pt-1">
          <button onClick={onAddToQuote}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-[#D4CFC7] text-[#2C2C2A] hover:border-[#C4A46B] hover:text-[#C4A46B] transition-colors">
            <ArrowRight size={11} /> Add to quote
          </button>
          <button onClick={onSendForPricing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-[#D4CFC7] text-[#2C2C2A] hover:border-[#2C2C2A] transition-colors">
            <Tag size={11} /> Price request
          </button>
        </div>
      </div>

      {lightboxIdx !== null && (
        <ImageLightbox urls={piece.image_urls} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  )
}

// ---- Main ----
export function PiecesClient({ initialPieces, suppliers, projects }: Props) {
  const router = useRouter()
  const [pieces, setPieces] = useState<Piece[]>(initialPieces)
  const [showAdd, setShowAdd] = useState(false)
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null)
  const [addToQuote, setAddToQuote] = useState<Piece | null>(null)
  const [sendingPricing, setSendingPricing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleSaved(p: Piece) {
    setPieces(prev => {
      const exists = prev.find(x => x.id === p.id)
      return exists ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
    setShowAdd(false)
    setEditingPiece(null)
    showToast(editingPiece ? 'Piece updated' : 'Piece added')
  }

  async function handleDelete(piece: Piece) {
    if (!window.confirm(`Delete "${piece.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/pieces/${piece.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPieces(prev => prev.filter(p => p.id !== piece.id))
      showToast('Piece deleted')
    }
  }

  async function handleSendForPricing(piece: Piece) {
    setSendingPricing(piece.id)
    try {
      const res = await fetch(`/api/pieces/${piece.id}/send-for-pricing`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/sourcing/${json.session_id}`)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSendingPricing(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg"
          style={{ background: '#2C2C2A', color: '#F5F2EC' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2C2C2A] tracking-tight">Our Pieces</h1>
          <p className="text-xs text-[#8A877F] mt-0.5">{pieces.length} piece{pieces.length !== 1 ? 's' : ''} in your library</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors"
          style={{ background: '#2C2C2A', color: '#F5F2EC' }}>
          <Plus size={14} /> Add piece
        </button>
      </div>

      {/* Empty state */}
      {pieces.length === 0 && (
        <div className="border-2 border-dashed border-[#D4CFC7] rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#F5F2EC' }}>
            <LayoutGrid size={22} className="text-[#8A877F]" />
          </div>
          <p className="text-sm font-semibold text-[#2C2C2A] mb-1">No pieces yet</p>
          <p className="text-sm text-[#8A877F] max-w-xs mx-auto mb-5">
            Build your design library — add pieces you&apos;ve designed with images, specs, and reference pricing.
          </p>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors"
            style={{ background: '#2C2C2A', color: '#F5F2EC' }}>
            <Plus size={14} /> Add your first piece
          </button>
        </div>
      )}

      {/* Grid */}
      {pieces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {pieces.map(p => (
            <PieceCard
              key={p.id}
              piece={p}
              onEdit={() => setEditingPiece(p)}
              onDelete={() => handleDelete(p)}
              onAddToQuote={() => setAddToQuote(p)}
              onSendForPricing={() => handleSendForPricing(p)}
            />
          ))}
        </div>
      )}

      {/* Sending for pricing overlay */}
      {sendingPricing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 flex items-center gap-4 shadow-2xl">
            <Loader2 size={20} className="animate-spin text-[#C4A46B]" />
            <p className="text-sm font-medium text-[#2C2C2A]">Creating price request…</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {(showAdd || editingPiece) && (
        <PieceModal
          piece={editingPiece}
          suppliers={suppliers}
          onClose={() => { setShowAdd(false); setEditingPiece(null) }}
          onSaved={handleSaved}
        />
      )}

      {addToQuote && (
        <AddToQuoteModal
          piece={addToQuote}
          projects={projects}
          onClose={() => setAddToQuote(null)}
          onDone={() => showToast('Added to quote')}
        />
      )}
    </div>
  )
}
