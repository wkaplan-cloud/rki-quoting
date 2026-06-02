'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Hotel, Plus, Pencil, Trash2, X, ChevronRight, Clock, CheckCircle2, FileText, Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Request {
  id: string
  hotel_name: string
  hotel_id: string
  status: string
  submitted_at: string
  quote_project_id: string | null
  capital_request_items: { id: string }[]
}

interface HotelRow {
  id: string
  name: string
  active: boolean
}

interface Props {
  initialRequests: Request[]
  hotels: HotelRow[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'New',        color: 'bg-blue-100 text-blue-700',    icon: <Clock size={11} /> },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: <Settings2 size={11} /> },
  quoted:      { label: 'Quoted',     color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
}

export function CapitalHotelsClient({ initialRequests, hotels: initialHotels }: Props) {
  const router = useRouter()
  const [requests] = useState(initialRequests)
  const [hotels, setHotels] = useState(initialHotels)
  const [showHotelsPanel, setShowHotelsPanel] = useState(false)
  const [newHotelName, setNewHotelName] = useState('')
  const [savingHotel, setSavingHotel] = useState(false)
  const [editingHotel, setEditingHotel] = useState<{ id: string; name: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter)

  // Group by hotel
  const grouped = filtered.reduce<Record<string, Request[]>>((acc, r) => {
    acc[r.hotel_name] = acc[r.hotel_name] ?? []
    acc[r.hotel_name].push(r)
    return acc
  }, {})

  async function addHotel() {
    if (!newHotelName.trim()) return
    setSavingHotel(true)
    try {
      const res = await fetch('/api/capital-hotels/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHotelName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setHotels(prev => [...prev, json.hotel].sort((a, b) => a.name.localeCompare(b.name)))
      setNewHotelName('')
      toast.success('Hotel added')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingHotel(false)
    }
  }

  async function saveHotelEdit() {
    if (!editingHotel) return
    const res = await fetch(`/api/capital-hotels/hotels/${editingHotel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingHotel.name }),
    })
    if (res.ok) {
      setHotels(prev => prev.map(h => h.id === editingHotel.id ? { ...h, name: editingHotel.name } : h))
      setEditingHotel(null)
      toast.success('Hotel updated')
    }
  }

  async function toggleHotelActive(hotel: HotelRow) {
    const res = await fetch(`/api/capital-hotels/hotels/${hotel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !hotel.active }),
    })
    if (res.ok) {
      setHotels(prev => prev.map(h => h.id === hotel.id ? { ...h, active: !h.active } : h))
    }
  }

  async function deleteHotel(id: string) {
    if (!confirm('Delete this hotel? This cannot be undone.')) return
    const res = await fetch(`/api/capital-hotels/hotels/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHotels(prev => prev.filter(h => h.id !== id))
      toast.success('Hotel removed')
      router.refresh()
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'in_progress', 'quoted'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#1A1A18] text-white'
                  : 'bg-white text-[#8A877F] border border-[#E8E4DC] hover:border-[#C4A46B]'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label}
              {s === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowHotelsPanel(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E4DC] rounded-lg text-sm text-[#8A877F] hover:text-[#1A1A18] hover:border-[#C4A46B] transition-colors"
        >
          <Hotel size={14} />
          Manage Hotels
        </button>
      </div>

      {/* Requests grouped by hotel */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-12 text-center">
          <Hotel size={36} className="text-[#D4CFC7] mx-auto mb-3" />
          <p className="text-sm text-[#8A877F]">No requests yet.</p>
          <p className="text-xs text-[#C4BFB6] mt-1">
            Share <strong>quotinghub.co.za/capital-portal</strong> with The Capital Hotels team.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([hotelName, hotelRequests]) => (
          <div key={hotelName} className="bg-white rounded-2xl border border-[#E8E4DC] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F0EDE8] flex items-center gap-2">
              <Hotel size={15} className="text-[#1B4F8A]" />
              <h3 className="font-semibold text-[#1A1A18] text-sm">{hotelName}</h3>
              <span className="text-xs text-[#8A877F] ml-1">{hotelRequests.length} request{hotelRequests.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-[#F5F2EC]">
              {hotelRequests.map(req => {
                const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending
                const date = new Date(req.submitted_at)
                const itemCount = req.capital_request_items?.length ?? 0
                return (
                  <Link
                    key={req.id}
                    href={`/capital-hotels/${req.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-[#F5F2EC]/60 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-medium text-sm text-[#1A1A18]">
                          {date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#8A877F]">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                        {req.quote_project_id && <span className="ml-2 text-emerald-600 font-medium">· Quote created</span>}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[#C4BFB6] group-hover:text-[#1A1A18] transition-colors flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Manage Hotels Panel */}
      {showHotelsPanel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setShowHotelsPanel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DC]">
              <h3 className="font-semibold text-[#1A1A18]">Manage Hotels</h3>
              <button onClick={() => setShowHotelsPanel(false)} className="text-[#8A877F] hover:text-[#1A1A18] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {hotels.map(hotel => (
                <div key={hotel.id} className="flex items-center gap-2 p-3 bg-[#F5F2EC] rounded-xl">
                  {editingHotel?.id === hotel.id ? (
                    <>
                      <input
                        className="flex-1 px-3 py-1.5 text-sm border border-[#D4CFC7] rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white"
                        value={editingHotel.name}
                        onChange={e => setEditingHotel({ ...editingHotel, name: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') saveHotelEdit(); if (e.key === 'Escape') setEditingHotel(null) }}
                        autoFocus
                      />
                      <button onClick={saveHotelEdit} className="text-xs text-emerald-600 font-medium px-2 py-1 hover:bg-emerald-50 rounded-lg transition-colors">Save</button>
                      <button onClick={() => setEditingHotel(null)} className="text-xs text-[#8A877F] hover:text-[#1A1A18] transition-colors"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm ${hotel.active ? 'text-[#1A1A18]' : 'text-[#8A877F] line-through'}`}>{hotel.name}</span>
                      <button onClick={() => setEditingHotel({ id: hotel.id, name: hotel.name })} className="text-[#8A877F] hover:text-[#1A1A18] transition-colors p-1">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggleHotelActive(hotel)} className={`text-xs px-2 py-1 rounded-lg transition-colors ${hotel.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                        {hotel.active ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => deleteHotel(hotel.id)} className="text-[#8A877F] hover:text-red-500 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-[#E8E4DC]">
              <div className="flex gap-2">
                <input
                  className="flex-1 px-4 py-2.5 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white"
                  placeholder="Hotel name…"
                  value={newHotelName}
                  onChange={e => setNewHotelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addHotel()}
                />
                <button
                  onClick={addHotel}
                  disabled={savingHotel || !newHotelName.trim()}
                  className="px-4 py-2.5 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
