'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface Price {
  id: string
  supplier_id: string
  supplier_name: string
  cost_price: number
  notes: string | null
  updated_at: string
}

interface Piece {
  id: string
  name: string
  description: string | null
  category: string
  image_url: string | null
  prices: Price[]
}

interface Props {
  initialPieces: Piece[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number }[]
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white'
const LABEL = 'block text-xs font-semibold text-[#8A877F] uppercase tracking-widest mb-1'

const CATEGORIES = ['general', 'bedding', 'curtains', 'cushions', 'upholstery', 'carpet', 'blinds', 'artwork', 'lighting', 'furniture']

function PriceRow({
  price,
  onDelete,
}: {
  price: Price
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-[#F5F2EC] rounded-lg text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-[#1A1A18]">{price.supplier_name}</span>
        {price.notes && <span className="text-[#8A877F] text-xs ml-2">{price.notes}</span>}
      </div>
      <div className="flex items-center gap-3 ml-3">
        <span className="font-semibold text-[#1A1A18]">R{price.cost_price.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
        <button onClick={onDelete} className="text-[#C4BFB6] hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function AddPriceForm({
  pieceId,
  suppliers,
  existingSupplierIds,
  onAdded,
  onCancel,
}: {
  pieceId: string
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
        body: JSON.stringify({ supplier_id: supplierId, supplier_name: supplier.supplier_name, cost_price: parseFloat(costPrice), notes: notes.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onAdded(json.price)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!available.length) {
    return (
      <div className="text-xs text-[#8A877F] text-center py-2">
        All suppliers already have prices for this piece.
        <button onClick={onCancel} className="ml-2 text-[#1B4F8A] hover:underline">Cancel</button>
      </div>
    )
  }

  return (
    <div className="border border-[#E8E4DC] rounded-xl p-3 space-y-3">
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
      <div>
        <label className={LABEL}>Notes (optional)</label>
        <input className={INPUT} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. per metre, per unit…" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !supplierId || !costPrice}
          className="flex-1 py-2 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163d6e] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Price'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function PieceCard({
  piece,
  suppliers,
  onUpdated,
  onDeleted,
}: {
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
  const [saving, setSaving] = useState(false)
  const [showAddPrice, setShowAddPrice] = useState(false)
  const [prices, setPrices] = useState<Price[]>(piece.prices ?? [])

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/capital-pieces/${piece.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onUpdated({ ...piece, name, description: description || null, category })
      setEditing(false)
      toast.success('Piece updated')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function deletePrice(supplierId: string) {
    const res = await fetch(`/api/capital-pieces/${piece.id}/prices?supplier_id=${supplierId}`, { method: 'DELETE' })
    if (res.ok) {
      setPrices(prev => prev.filter(p => p.supplier_id !== supplierId))
      toast.success('Price removed')
    }
  }

  async function deletePiece() {
    if (!confirm(`Delete "${piece.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/capital-pieces/${piece.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted(); toast.success('Piece deleted') }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#F5F2EC]/50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <div onClick={e => e.stopPropagation()} className="space-y-2">
              <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
                <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-[#1B4F8A] text-white text-xs rounded-lg hover:bg-[#163d6e] disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="font-medium text-sm text-[#1A1A18]">{piece.name}</div>
              {piece.description && <div className="text-xs text-[#8A877F] mt-0.5">{piece.description}</div>}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-medium bg-[#F0EDE8] text-[#8A877F] px-2 py-0.5 rounded-full capitalize">{piece.category}</span>
                <span className="text-[10px] text-[#8A877F]">{prices.length} price{prices.length !== 1 ? 's' : ''}</span>
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); setExpanded(true) }}
              className="p-2 text-[#C4BFB6] hover:text-[#1A1A18] transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); deletePiece() }}
              className="p-2 text-[#C4BFB6] hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
            {expanded ? <ChevronUp size={15} className="text-[#8A877F]" /> : <ChevronDown size={15} className="text-[#8A877F]" />}
          </div>
        )}
      </div>

      {expanded && !editing && (
        <div className="border-t border-[#F0EDE8] px-5 py-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8A877F] uppercase tracking-widest">Supplier Prices</span>
            {!showAddPrice && (
              <button
                onClick={() => setShowAddPrice(true)}
                className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6e] transition-colors font-medium"
              >
                <Plus size={13} /> Add Price
              </button>
            )}
          </div>
          {prices.length === 0 && !showAddPrice && (
            <p className="text-xs text-[#8A877F] py-2">No prices yet. Add a supplier price to use this piece.</p>
          )}
          {prices.map(price => (
            <PriceRow key={price.id} price={price} onDelete={() => deletePrice(price.supplier_id)} />
          ))}
          {showAddPrice && (
            <AddPriceForm
              pieceId={piece.id}
              suppliers={suppliers}
              existingSupplierIds={new Set(prices.map(p => p.supplier_id))}
              onAdded={p => { setPrices(prev => [...prev, p]); setShowAddPrice(false) }}
              onCancel={() => setShowAddPrice(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function CapitalPiecesClient({ initialPieces, suppliers }: Props) {
  const [pieces, setPieces] = useState(initialPieces)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('general')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  async function addPiece() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/capital-pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, category: newCat }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPieces(prev => [json.piece, ...prev])
      setNewName(''); setNewDesc(''); setNewCat('general'); setShowAdd(false)
      toast.success('Piece added')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = pieces.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="flex-1 min-w-[200px] px-4 py-2.5 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white"
          placeholder="Search pieces…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] transition-colors"
        >
          <Plus size={15} />
          Add Piece
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A18]">New Piece</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Name <span className="text-red-400">*</span></label>
              <input className={INPUT} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Roman Blind" />
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <select className={INPUT} value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={LABEL}>Description</label>
              <input className={INPUT} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional details" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addPiece}
              disabled={saving || !newName.trim()}
              className="px-5 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Add Piece'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm text-[#8A877F] hover:text-[#1A1A18] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-12 text-center">
          <DollarSign size={36} className="text-[#D4CFC7] mx-auto mb-3" />
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
