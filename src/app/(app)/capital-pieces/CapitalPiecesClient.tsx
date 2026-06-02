'use client'

import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, ImagePlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { compressImage } from '@/lib/compressImage'

interface Price {
  id: string
  supplier_id: string
  supplier_name: string
  cost_price: number
  notes: string | null
  variant_id: string | null
}

interface Variant {
  id: string
  label: string
  dimensions: string | null
  sort_order: number
  prices: Price[]
}

interface Piece {
  id: string
  name: string
  description: string | null
  category: string
  fabric: string | null
  image_url: string | null
  prices: Price[]       // base piece-level prices (variant_id = null)
  variants: Variant[]
}

interface Props {
  initialPieces: Piece[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number }[]
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white'
const LABEL = 'block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1'
const CATEGORIES = ['general', 'bedding', 'curtains', 'cushions', 'upholstery', 'carpet', 'blinds', 'artwork', 'lighting', 'furniture']

// ── Price Row ─────────────────────────────────────────────────────────────────
function PriceRow({ price, onDelete }: { price: Price; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-[#F5F2EC] rounded-lg text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-[#1A1A18]">{price.supplier_name}</span>
        {price.notes && <span className="text-[#8A877F] text-xs ml-2">{price.notes}</span>}
      </div>
      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
        <span className="font-semibold text-[#1A1A18]">R{price.cost_price.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
        <button onClick={onDelete} className="text-[#C4BFB6] hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ── Add Price Form ────────────────────────────────────────────────────────────
function AddPriceForm({
  pieceId, variantId, suppliers, existingSupplierIds, onAdded, onCancel,
}: {
  pieceId: string
  variantId: string | null
  suppliers: Props['suppliers']
  existingSupplierIds: Set<string>
  onAdded: (price: Price) => void
  onCancel: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const available = suppliers.filter(s => !existingSupplierIds.has(s.id))

  async function handleSave() {
    if (!supplierId || !costPrice) return
    setSaving(true)
    try {
      const supplier = suppliers.find(s => s.id === supplierId)!
      const res = await fetch(`/api/capital-pieces/${pieceId}/prices`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId, supplier_name: supplier.supplier_name, cost_price: parseFloat(costPrice), notes: notes.trim() || null, variant_id: variantId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded(json.price)
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  if (!available.length) return (
    <div className="text-xs text-[#8A877F] text-center py-2">
      All suppliers already priced. <button onClick={onCancel} className="text-[#1B4F8A] hover:underline">Cancel</button>
    </div>
  )

  return (
    <div className="border border-[#E8E4DC] rounded-xl p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Supplier</label>
          <select className={INPUT} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">Select…</option>
            {available.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Cost Price (R)</label>
          <input className={INPUT} type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <input className={INPUT} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (e.g. per metre, per unit)…" />
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !supplierId || !costPrice} className="flex-1 py-2 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163d6e] disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Price'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ── Variant Section ───────────────────────────────────────────────────────────
function VariantSection({
  variant, pieceId, suppliers, onUpdated, onDeleted,
}: {
  variant: Variant
  pieceId: string
  suppliers: Props['suppliers']
  onUpdated: (v: Variant) => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(variant.label)
  const [dimensions, setDimensions] = useState(variant.dimensions ?? '')
  const [prices, setPrices] = useState<Price[]>(variant.prices)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/capital-pieces/${pieceId}/variants/${variant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, dimensions }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onUpdated({ ...variant, label, dimensions: dimensions || null, prices })
      setEditing(false)
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  async function deleteVariant() {
    if (!confirm(`Delete size "${variant.label}"? All its prices will also be removed.`)) return
    const res = await fetch(`/api/capital-pieces/${pieceId}/variants/${variant.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted(); toast.success('Size removed') }
  }

  async function deletePrice(supplierId: string) {
    const res = await fetch(`/api/capital-pieces/${pieceId}/prices?supplier_id=${supplierId}&variant_id=${variant.id}`, { method: 'DELETE' })
    if (res.ok) { setPrices(prev => prev.filter(p => p.supplier_id !== supplierId)); toast.success('Price removed') }
  }

  return (
    <div className="border border-[#E8E4DC] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F2EC]">
        {editing ? (
          <>
            <input className="flex-1 px-2 py-1.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Sandton)" />
            <input className="w-36 px-2 py-1.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white" value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="Dimensions" />
            <button onClick={saveEdit} disabled={saving} className="text-xs text-emerald-600 font-medium px-2 py-1 hover:bg-emerald-50 rounded-lg transition-colors">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="text-[#8A877F] hover:text-[#1A1A18] transition-colors"><X size={13} /></button>
          </>
        ) : (
          <>
            <span className="font-semibold text-sm text-[#1A1A18] flex-1">{variant.label}</span>
            {variant.dimensions && <span className="text-xs text-[#8A877F]">{variant.dimensions}</span>}
            <button onClick={() => setEditing(true)} className="text-[#C4BFB6] hover:text-[#1A1A18] transition-colors p-1"><Pencil size={12} /></button>
            <button onClick={deleteVariant} className="text-[#C4BFB6] hover:text-red-500 transition-colors p-1"><Trash2 size={12} /></button>
          </>
        )}
      </div>
      <div className="p-3 space-y-2">
        {prices.filter(p => p.variant_id === variant.id).map(price => (
          <PriceRow key={price.id} price={price} onDelete={() => deletePrice(price.supplier_id)} />
        ))}
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6e] transition-colors font-medium">
            <Plus size={12} /> Add supplier price
          </button>
        ) : (
          <AddPriceForm
            pieceId={pieceId}
            variantId={variant.id}
            suppliers={suppliers}
            existingSupplierIds={new Set(prices.filter(p => p.variant_id === variant.id).map(p => p.supplier_id))}
            onAdded={p => { setPrices(prev => [...prev, p]); setShowAdd(false) }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Piece Card ────────────────────────────────────────────────────────────────
function PieceCard({ piece, suppliers, onUpdated, onDeleted }: {
  piece: Piece
  suppliers: Props['suppliers']
  onUpdated: (p: Piece) => void
  onDeleted: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(piece.name)
  const [description, setDescription] = useState(piece.description ?? '')
  const [category, setCategory] = useState(piece.category)
  const [fabric, setFabric] = useState(piece.fabric ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState(piece.image_url)
  const [prices, setPrices] = useState<Price[]>(piece.prices ?? [])
  const [variants, setVariants] = useState<Variant[]>(piece.variants ?? [])
  const [showAddPrice, setShowAddPrice] = useState(false)
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [newVariantLabel, setNewVariantLabel] = useState('')
  const [newVariantDim, setNewVariantDim] = useState('')
  const [addingVariant, setAddingVariant] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(file: File) {
    setUploadingImage(true)
    try {
      let compressed = file
      try { compressed = await compressImage(file) } catch { /* use raw */ }
      const form = new FormData()
      form.append('file', compressed)
      const res = await fetch(`/api/capital-pieces/${piece.id}/image`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setImageUrl(json.url)
      onUpdated({ ...piece, image_url: json.url, fabric: fabric || null, name, description: description || null, category })
      toast.success('Image updated')
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploadingImage(false) }
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/capital-pieces/${piece.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category, fabric }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onUpdated({ ...piece, name, description: description || null, category, fabric: fabric || null })
      setEditing(false)
      toast.success('Piece updated')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  async function addVariant() {
    if (!newVariantLabel.trim()) return
    setAddingVariant(true)
    try {
      const res = await fetch(`/api/capital-pieces/${piece.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newVariantLabel.trim(), dimensions: newVariantDim.trim() || null, sort_order: variants.length }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setVariants(prev => [...prev, json.variant])
      setNewVariantLabel(''); setNewVariantDim(''); setShowAddVariant(false)
      toast.success('Size added')
    } catch (e) { toast.error((e as Error).message) }
    finally { setAddingVariant(false) }
  }

  async function deleteBasePrices(supplierId: string) {
    const res = await fetch(`/api/capital-pieces/${piece.id}/prices?supplier_id=${supplierId}`, { method: 'DELETE' })
    if (res.ok) { setPrices(prev => prev.filter(p => p.supplier_id !== supplierId)); toast.success('Price removed') }
  }

  async function deletePiece() {
    if (!confirm(`Delete "${piece.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/capital-pieces/${piece.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted(); toast.success('Piece deleted') }
  }

  const basePrices = prices.filter(p => p.variant_id === null)
  const hasVariants = variants.length > 0

  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] overflow-hidden">
      {/* Header row */}
      <div className="flex gap-3 p-4 cursor-pointer hover:bg-[#F5F2EC]/40 transition-colors" onClick={() => !editing && setExpanded(e => !e)}>
        {/* Image thumbnail */}
        <div className="flex-shrink-0 relative" onClick={e => e.stopPropagation()}>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = '' }} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-xl border border-[#E8E4DC] overflow-hidden flex items-center justify-center bg-[#F5F2EC] hover:border-[#1B4F8A] transition-colors group relative"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={18} className="text-[#C4BFB6] group-hover:text-[#1B4F8A] transition-colors" />
            )}
            {uploadingImage && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <Loader2 size={14} className="animate-spin text-[#1B4F8A]" />
              </div>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div onClick={e => e.stopPropagation()} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Piece name" />
                <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <input className={INPUT} value={fabric} onChange={e => setFabric(e.target.value)} placeholder="Fabric (e.g. Colonial Blue Linen, Twinbru SKU: XXX)" />
              <input className={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-[#1B4F8A] text-white text-xs rounded-lg hover:bg-[#163d6e] disabled:opacity-50 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="font-medium text-sm text-[#1A1A18]">{piece.name}</div>
              {piece.fabric && <div className="text-xs text-[#1B4F8A] mt-0.5 font-medium">{piece.fabric}</div>}
              {piece.description && <div className="text-xs text-[#8A877F] mt-0.5">{piece.description}</div>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-medium bg-[#F0EDE8] text-[#8A877F] px-2 py-0.5 rounded-full capitalize">{piece.category}</span>
                {hasVariants
                  ? <span className="text-[10px] text-[#8A877F]">{variants.length} size{variants.length !== 1 ? 's' : ''}</span>
                  : <span className="text-[10px] text-[#8A877F]">{basePrices.length} price{basePrices.length !== 1 ? 's' : ''}</span>
                }
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 ml-1 flex-shrink-0">
            <button onClick={e => { e.stopPropagation(); setEditing(true); setExpanded(true) }} className="p-2 text-[#C4BFB6] hover:text-[#1A1A18] transition-colors"><Pencil size={13} /></button>
            <button onClick={e => { e.stopPropagation(); deletePiece() }} className="p-2 text-[#C4BFB6] hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
            {expanded ? <ChevronUp size={15} className="text-[#8A877F]" /> : <ChevronDown size={15} className="text-[#8A877F]" />}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && !editing && (
        <div className="border-t border-[#F0EDE8] px-4 py-4 space-y-4">

          {/* Sizes / Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#8A877F] uppercase tracking-widest">Sizes</span>
              {!showAddVariant && (
                <button onClick={() => setShowAddVariant(true)} className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6e] transition-colors font-medium">
                  <Plus size={12} /> Add Size
                </button>
              )}
            </div>

            <div className="space-y-2">
              {variants.map(v => (
                <VariantSection
                  key={v.id}
                  variant={v}
                  pieceId={piece.id}
                  suppliers={suppliers}
                  onUpdated={updated => setVariants(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDeleted={() => setVariants(prev => prev.filter(x => x.id !== v.id))}
                />
              ))}

              {!hasVariants && (
                <p className="text-xs text-[#8A877F]">No sizes yet — add a size if this piece has hotel-specific dimensions (e.g. Sandton 2.2m, Melrose 1.8m).</p>
              )}

              {showAddVariant && (
                <div className="border border-dashed border-[#1B4F8A]/40 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={INPUT} value={newVariantLabel} onChange={e => setNewVariantLabel(e.target.value)} placeholder="Label (e.g. Sandton)" autoFocus />
                    <input className={INPUT} value={newVariantDim} onChange={e => setNewVariantDim(e.target.value)} placeholder="Dimensions (e.g. 2200 x 900mm)" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addVariant} disabled={addingVariant || !newVariantLabel.trim()} className="px-4 py-2 bg-[#1B4F8A] text-white text-xs font-medium rounded-lg hover:bg-[#163d6e] disabled:opacity-50 transition-colors">
                      {addingVariant ? 'Adding…' : 'Add Size'}
                    </button>
                    <button onClick={() => { setShowAddVariant(false); setNewVariantLabel(''); setNewVariantDim('') }} className="px-3 py-2 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Base prices (for pieces without variants) */}
          {!hasVariants && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#8A877F] uppercase tracking-widest">Supplier Prices</span>
                {!showAddPrice && (
                  <button onClick={() => setShowAddPrice(true)} className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6e] transition-colors font-medium">
                    <Plus size={12} /> Add Price
                  </button>
                )}
              </div>
              {basePrices.length === 0 && !showAddPrice && (
                <p className="text-xs text-[#8A877F]">No prices yet. Add prices or add sizes above if dimensions vary per hotel.</p>
              )}
              {basePrices.map(price => (
                <PriceRow key={price.id} price={price} onDelete={() => deleteBasePrices(price.supplier_id)} />
              ))}
              {showAddPrice && (
                <AddPriceForm
                  pieceId={piece.id}
                  variantId={null}
                  suppliers={suppliers}
                  existingSupplierIds={new Set(basePrices.map(p => p.supplier_id))}
                  onAdded={p => { setPrices(prev => [...prev, p]); setShowAddPrice(false) }}
                  onCancel={() => setShowAddPrice(false)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────
export function CapitalPiecesClient({ initialPieces, suppliers }: Props) {
  const [pieces, setPieces] = useState(initialPieces)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('general')
  const [newFabric, setNewFabric] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  async function addPiece() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/capital-pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, category: newCat, fabric: newFabric.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPieces(prev => [json.piece, ...prev])
      setNewName(''); setNewDesc(''); setNewCat('general'); setNewFabric(''); setShowAdd(false)
      toast.success('Piece added')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const filtered = pieces.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.fabric ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[200px] px-4 py-2.5 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white"
          placeholder="Search by name or fabric…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] transition-colors"
        >
          <Plus size={15} /> Add Piece
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A18]">New Piece</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Name <span className="text-red-400">*</span></label>
              <input className={INPUT} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Colonial Couch" />
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <select className={INPUT} value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Fabric</label>
              <input className={INPUT} value={newFabric} onChange={e => setNewFabric(e.target.value)} placeholder="e.g. Colonial Blue Linen" />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Description</label>
              <input className={INPUT} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional details" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addPiece} disabled={saving || !newName.trim()} className="px-5 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add Piece'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-12 text-center">
          <p className="text-sm text-[#8A877F]">{search ? 'No pieces match your search.' : 'No pieces yet. Add your first Capital piece above.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(piece => (
            <PieceCard
              key={piece.id}
              piece={piece}
              suppliers={suppliers}
              onUpdated={updated => setPieces(prev => prev.map(p => p.id === updated.id ? updated : p))}
              onDeleted={() => setPieces(prev => prev.filter(p => p.id !== piece.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
