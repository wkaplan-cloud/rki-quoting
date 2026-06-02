'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Hotel, Clock, Settings2, CheckCircle2,
  X, Search, Plus, Loader2, ExternalLink, Camera, Download
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Price {
  id: string
  supplier_id: string
  supplier_name: string
  cost_price: number
  notes: string | null
}

interface Piece {
  id: string
  name: string
  description: string | null
  category: string
  prices: Price[]
}

interface RequestItem {
  id: string
  image_url: string | null
  description: string
  quantity: number
  capital_piece_id: string | null
  piece_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  cost_price: number | null
  markup_percentage: number | null
  sort_order: number
}

interface Request {
  id: string
  hotel_name: string
  status: string
  submitted_at: string
  quote_project_id: string | null
}

interface Props {
  request: Request
  initialItems: RequestItem[]
  pieces: Piece[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'New',         color: 'bg-blue-100 text-blue-700',      icon: <Clock size={11} /> },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',    icon: <Settings2 size={11} /> },
  quoted:      { label: 'Quoted',      color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
}

// ── Piece Picker Modal ────────────────────────────────────────────────────────
function PiecePicker({
  pieces,
  suppliers,
  onSelect,
  onAddNew,
  onClose,
}: {
  pieces: Piece[]
  suppliers: Props['suppliers']
  onSelect: (piece: Piece, price: Price, markupPct: number) => void
  onAddNew: (name: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null)
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null)
  const [newPieceName, setNewPieceName] = useState('')
  const [showAddNew, setShowAddNew] = useState(false)

  const filtered = pieces.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function getMarkup(supplierId: string) {
    return suppliers.find(s => s.id === supplierId)?.markup_percentage ?? 0
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DC]">
          <h3 className="font-semibold text-[#1A1A18]">
            {selectedPiece ? 'Choose Supplier & Price' : 'Select from Catalog'}
          </h3>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#1A1A18] transition-colors">
            <X size={18} />
          </button>
        </div>

        {!selectedPiece ? (
          <>
            {/* Search */}
            <div className="px-5 py-3 border-b border-[#F0EDE8]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
                <input
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white"
                  placeholder="Search pieces…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Pieces list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map(piece => (
                <button
                  key={piece.id}
                  onClick={() => { setSelectedPiece(piece); setSelectedPrice(piece.prices[0] ?? null) }}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EC] transition-colors text-left border-b border-[#F5F2EC] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[#1A1A18]">{piece.name}</div>
                    {piece.description && <div className="text-xs text-[#8A877F] truncate">{piece.description}</div>}
                    <div className="text-[10px] text-[#8A877F] mt-0.5">
                      {piece.prices.length > 0
                        ? `${piece.prices.length} price${piece.prices.length !== 1 ? 's' : ''} — from R${Math.min(...piece.prices.map(p => p.cost_price)).toLocaleString('en-ZA')}`
                        : 'No prices set'
                      }
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-[#F0EDE8] text-[#8A877F] px-2 py-0.5 rounded-full capitalize flex-shrink-0">
                    {piece.category}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-[#8A877F]">
                  No pieces match <strong>"{search}"</strong>
                </div>
              )}
            </div>

            {/* Add new */}
            <div className="px-5 py-4 border-t border-[#E8E4DC]">
              {showAddNew ? (
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2.5 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white"
                    placeholder="New piece name…"
                    value={newPieceName}
                    onChange={e => setNewPieceName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newPieceName.trim()) { onAddNew(newPieceName.trim()); setShowAddNew(false) } }}
                    autoFocus
                  />
                  <button
                    onClick={() => { if (newPieceName.trim()) { onAddNew(newPieceName.trim()); setShowAddNew(false) } }}
                    className="px-4 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] transition-colors"
                  >
                    Add
                  </button>
                  <button onClick={() => setShowAddNew(false)} className="px-3 text-[#8A877F]"><X size={16} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddNew(true)}
                  className="w-full py-2.5 border-2 border-dashed border-[#D4CFC7] rounded-xl flex items-center justify-center gap-2 text-sm text-[#8A877F] hover:border-[#1B4F8A] hover:text-[#1B4F8A] transition-colors"
                >
                  <Plus size={15} />
                  This piece doesn't exist — add it
                </button>
              )}
            </div>
          </>
        ) : (
          /* Price selector */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <button
                onClick={() => setSelectedPiece(null)}
                className="text-xs text-[#1B4F8A] hover:underline flex items-center gap-1 mb-3"
              >
                <ArrowLeft size={12} /> Back to catalog
              </button>
              <div className="font-semibold text-[#1A1A18]">{selectedPiece.name}</div>
              {selectedPiece.description && <div className="text-sm text-[#8A877F]">{selectedPiece.description}</div>}
            </div>

            {selectedPiece.prices.length === 0 ? (
              <div className="text-sm text-[#8A877F] py-4 text-center border border-dashed border-[#D4CFC7] rounded-xl">
                No supplier prices for this piece yet.
                <br />
                <Link href="/capital-pieces" className="text-[#1B4F8A] hover:underline text-xs mt-1 inline-block">
                  Add prices in Capital Pieces →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#8A877F] uppercase tracking-widest">Choose a supplier</p>
                {selectedPiece.prices.map(price => (
                  <button
                    key={price.id}
                    onClick={() => setSelectedPrice(price)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors text-left ${
                      selectedPrice?.id === price.id
                        ? 'border-[#1B4F8A] bg-blue-50'
                        : 'border-[#E8E4DC] hover:border-[#1B4F8A]/40'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm text-[#1A1A18]">{price.supplier_name}</div>
                      {price.notes && <div className="text-xs text-[#8A877F]">{price.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#1A1A18]">R{price.cost_price.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-[#8A877F]">{getMarkup(price.supplier_id)}% markup</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPrice && (
              <button
                onClick={() => onSelect(selectedPiece, selectedPrice, getMarkup(selectedPrice.supplier_id))}
                className="w-full py-3.5 bg-[#1B4F8A] text-white font-semibold rounded-xl hover:bg-[#163d6e] transition-colors"
              >
                Select {selectedPiece.name} — {selectedPrice.supplier_name}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function RequestDetail({ request, initialItems, pieces: initialPieces, suppliers }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [pieces, setPieces] = useState(initialPieces)
  const [status, setStatus] = useState(request.status)
  const [pickerItemId, setPickerItemId] = useState<string | null>(null)
  const [sendingQuote, setSendingQuote] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const allMatched = items.length > 0 && items.every(i => i.capital_piece_id)
  const canSendQuote = allMatched && status !== 'quoted'

  async function updateStatus(newStatus: string) {
    const res = await fetch(`/api/capital-hotels/${request.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setStatus(newStatus)
  }

  async function assignPiece(itemId: string, piece: Piece, price: Price, markupPct: number) {
    const res = await fetch(`/api/capital-hotels/${request.id}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capital_piece_id: piece.id,
        piece_name: piece.name,
        supplier_id: price.supplier_id,
        supplier_name: price.supplier_name,
        cost_price: price.cost_price,
        markup_percentage: markupPct,
      }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === itemId ? {
        ...i,
        capital_piece_id: piece.id,
        piece_name: piece.name,
        supplier_id: price.supplier_id,
        supplier_name: price.supplier_name,
        cost_price: price.cost_price,
        markup_percentage: markupPct,
      } : i))
      setPickerItemId(null)
      if (status === 'pending') updateStatus('in_progress')
      toast.success(`Matched: ${piece.name}`)
    }
  }

  async function clearItem(itemId: string) {
    const res = await fetch(`/api/capital-hotels/${request.id}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capital_piece_id: null, piece_name: null, supplier_id: null, supplier_name: null, cost_price: null, markup_percentage: null }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, capital_piece_id: null, piece_name: null, supplier_id: null, supplier_name: null, cost_price: null, markup_percentage: null } : i))
    }
  }

  async function handleAddNewPiece(name: string, itemId: string) {
    try {
      const res = await fetch('/api/capital-pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPieces(prev => [...prev, json.piece].sort((a, b) => a.name.localeCompare(b.name)))
      setPickerItemId(null)
      toast.success(`"${name}" added to Capital Pieces. Set supplier prices there, then come back to match it.`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function sendQuote() {
    if (!confirm('Create a QuotingHub quote from this request?')) return
    setSendingQuote(true)
    try {
      const res = await fetch(`/api/capital-hotels/${request.id}/send-quote`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Quote created!')
      router.push(`/projects/${json.project_id}`)
    } catch (e) {
      toast.error((e as Error).message)
      setSendingQuote(false)
    }
  }

  const matchedCount = items.filter(i => i.capital_piece_id).length

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E4DC] px-5 py-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/capital-hotels" className="flex items-center gap-1.5 text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors mb-3">
            <ArrowLeft size={13} /> Capital Hotels
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Hotel size={16} className="text-[#1B4F8A]" />
                <h1 className="text-lg font-semibold text-[#1A1A18]">{request.hotel_name}</h1>
              </div>
              <p className="text-sm text-[#8A877F]">
                {new Date(request.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{items.length} item{items.length !== 1 ? 's' : ''}
                {' · '}{matchedCount}/{items.length} matched
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                {cfg.icon}
                {cfg.label}
              </span>
              {request.quote_project_id && (
                <Link
                  href={`/projects/${request.quote_project_id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <ExternalLink size={11} />
                  View Quote
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="max-w-3xl mx-auto p-5 space-y-4">
        {items.map((item, idx) => {
          const matched = !!item.capital_piece_id
          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-colors ${matched ? 'border-emerald-200' : 'border-[#E8E4DC]'}`}
            >
              <div className="flex gap-4 p-5">
                {/* Image */}
                {item.image_url ? (
                  <button onClick={() => setLightboxUrl(item.image_url)} className="flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-xl border border-[#E8E4DC] hover:opacity-80 transition-opacity"
                    />
                  </button>
                ) : (
                  <div className="flex-shrink-0 w-20 h-20 rounded-xl border border-dashed border-[#D4CFC7] flex items-center justify-center text-[#C4BFB6]">
                    <Camera size={20} />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs text-[#8A877F] font-medium">Item {idx + 1}</span>
                      <p className="text-sm font-medium text-[#1A1A18] mt-0.5">{item.description}</p>
                      <p className="text-xs text-[#8A877F] mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    {matched && (
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Matched piece */}
                  {matched ? (
                    <div className="mt-3 flex items-center justify-between gap-2 bg-emerald-50 rounded-xl px-3 py-2.5">
                      <div>
                        <div className="text-xs font-semibold text-emerald-800">{item.piece_name}</div>
                        <div className="text-xs text-emerald-600">
                          {item.supplier_name} · R{(item.cost_price ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} · {item.markup_percentage ?? 0}% markup
                        </div>
                      </div>
                      <button
                        onClick={() => clearItem(item.id)}
                        className="text-emerald-400 hover:text-emerald-700 transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickerItemId(item.id)}
                      className="mt-3 w-full py-2.5 border-2 border-dashed border-[#1B4F8A]/30 rounded-xl text-xs font-medium text-[#1B4F8A] hover:border-[#1B4F8A] hover:bg-blue-50 transition-colors"
                    >
                      + Select from Capital Pieces
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Send Quote CTA */}
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5">
          {canSendQuote ? (
            <div className="text-center">
              <p className="text-sm text-[#1A1A18] font-medium mb-1">All items matched ✓</p>
              <p className="text-xs text-[#8A877F] mb-4">Create a QuotingHub quote with all {items.length} line items for {request.hotel_name}.</p>
              <button
                onClick={sendQuote}
                disabled={sendingQuote}
                className="px-8 py-3 bg-[#1B4F8A] text-white font-semibold rounded-xl hover:bg-[#163d6e] disabled:opacity-60 transition-colors flex items-center gap-2 mx-auto"
              >
                {sendingQuote ? <><Loader2 size={16} className="animate-spin" /> Creating Quote…</> : 'Send Quote →'}
              </button>
            </div>
          ) : request.status === 'quoted' ? (
            <div className="text-center">
              <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#1A1A18]">Quote already created</p>
              {request.quote_project_id && (
                <Link href={`/projects/${request.quote_project_id}`} className="text-xs text-[#1B4F8A] hover:underline mt-1 inline-flex items-center gap-1">
                  Open in Projects <ExternalLink size={11} />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-[#8A877F]">
                {matchedCount}/{items.length} items matched.{' '}
                {items.length - matchedCount > 0 && `Match ${items.length - matchedCount} more to create the quote.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Piece Picker */}
      {pickerItemId && (
        <PiecePicker
          pieces={pieces}
          suppliers={suppliers}
          onSelect={(piece, price, markup) => assignPiece(pickerItemId, piece, price, markup)}
          onAddNew={name => handleAddNewPiece(name, pickerItemId)}
          onClose={() => setPickerItemId(null)}
        />
      )}

      {/* Image Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" />
          <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <a
              href={lightboxUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-colors"
              title="Download image"
            >
              <Download size={18} />
            </a>
            <button
              onClick={() => setLightboxUrl(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
