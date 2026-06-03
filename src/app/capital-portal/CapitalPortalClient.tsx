'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Plus, X, Camera, Loader2, CheckCircle2, ChevronDown } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'

interface Hotel {
  id: string
  name: string
}

interface RequestItem {
  id: string
  imageFile: File | null
  imagePreview: string | null
  description: string
  quantity: number
  uploading: boolean
  uploadedUrl: string | null
}

function newItem(): RequestItem {
  return {
    id: crypto.randomUUID(),
    imageFile: null,
    imagePreview: null,
    description: '',
    quantity: 1,
    uploading: false,
    uploadedUrl: null,
  }
}

const INPUT = 'w-full px-4 py-3 text-sm border border-[#D4CFC7] rounded-xl focus:outline-none focus:border-[#1B4F8A] bg-white transition-colors'
const LABEL = 'block text-xs font-semibold text-[#6B6960] uppercase tracking-widest mb-1.5'

export default function CapitalPortalClient({ rkilogoUrl, businessName }: { rkilogoUrl: string | null; businessName: string }) {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [hotelsLoaded, setHotelsLoaded] = useState(false)
  const [hotelId, setHotelId] = useState('')
  const [hotelName, setHotelName] = useState('')
  const [items, setItems] = useState<RequestItem[]>([newItem()])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Load hotels on first render
  useState(() => {
    fetch('/api/capital-portal/hotels')
      .then(r => r.json())
      .then(d => { setHotels(d.hotels ?? []); setHotelsLoaded(true) })
      .catch(() => setHotelsLoaded(true))
  })

  function updateItem(id: string, patch: Partial<RequestItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleImageSelect(itemId: string, rawFile: File) {
    // Show preview immediately from raw file
    const preview = URL.createObjectURL(rawFile)
    updateItem(itemId, { imageFile: rawFile, imagePreview: preview, uploading: true, uploadedUrl: null })

    try {
      // Compress before upload — falls back to raw file if compression fails (e.g. HEIC)
      let file = rawFile
      try { file = await compressImage(rawFile) } catch { /* use raw */ }

      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/capital-portal/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      updateItem(itemId, { uploading: false, uploadedUrl: json.url })
    } catch (e) {
      updateItem(itemId, { uploading: false, imageFile: null, imagePreview: null })
      alert((e as Error).message)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!hotelId) { setError('Please select a hotel.'); return }
    const validItems = items.filter(i => i.description.trim())
    if (!validItems.length) { setError('Please add at least one item with a description.'); return }
    const stillUploading = items.some(i => i.uploading)
    if (stillUploading) { setError('Please wait for all images to finish uploading.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/capital-portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: hotelId,
          hotel_name: hotelName,
          items: validItems.map((item, idx) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            image_url: item.uploadedUrl ?? null,
            sort_order: idx,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submission failed')
      setSubmitted(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F2EC] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E4DC] p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-5">
            <CheckCircle2 size={52} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-[#1A1A18] mb-2">Request Sent</h2>
          <p className="text-sm text-[#8A877F] leading-relaxed mb-6">
            Your maintenance request from <strong className="text-[#1A1A18]">{hotelName}</strong> has been sent to R Kaplan Interiors. The team will be in touch.
          </p>
          <button
            onClick={() => { setSubmitted(false); setItems([newItem()]); setHotelId(''); setHotelName('') }}
            className="w-full py-3 bg-[#1B4F8A] text-white text-sm font-medium rounded-xl hover:bg-[#163d6e] transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E4DC] px-5 py-5">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          {/* Capital logo */}
          <Image
            src="/Capital-Logo.png"
            alt="The Capital Hotels"
            width={180}
            height={60}
            className="h-12 w-auto object-contain"
          />
          {/* Divider */}
          <div className="w-px h-10 bg-[#E8E4DC] flex-shrink-0" />
          {/* RKI logo + name */}
          <div className="flex items-center gap-3">
            {rkilogoUrl
              ? // eslint-disable-next-line @next/next/no-img-element
                <img src={rkilogoUrl} alt={businessName} className="h-12 w-auto max-w-[140px] object-contain" />
              : <Image src="/logo.png" alt={businessName} width={48} height={48} className="h-12 w-auto object-contain" />
            }
            <div className="hidden sm:block">
              <p className="text-[10px] text-[#8A877F] uppercase tracking-widest font-medium leading-tight">Powered by</p>
              <p className="text-xs font-semibold text-[#1A1A18] leading-tight">{businessName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-5 space-y-5 pb-52">
        {/* Hotel selector */}
        <div className="bg-white rounded-2xl border border-[#E8E4DC] p-5 shadow-sm">
          <label className={LABEL}>Select Hotel</label>
          <div className="relative">
            <select
              className={`${INPUT} appearance-none pr-10`}
              value={hotelId}
              onChange={e => {
                const opt = hotels.find(h => h.id === e.target.value)
                setHotelId(e.target.value)
                setHotelName(opt?.name ?? '')
              }}
            >
              <option value="">— Choose your hotel —</option>
              {hotels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A877F] pointer-events-none" />
          </div>
          {!hotelsLoaded && (
            <p className="text-xs text-[#8A877F] mt-2 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Loading hotels…
            </p>
          )}
        </div>

        {/* Items */}
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-[#E8E4DC] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-[#8A877F] uppercase tracking-widest">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button onClick={() => removeItem(item.id)} className="text-[#8A877F] hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Image upload */}
              <div className="mb-4">
                <label className={LABEL}>Photo</label>
                <input
                  ref={el => { fileRefs.current[item.id] = el }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleImageSelect(item.id, file)
                    e.target.value = ''
                  }}
                />
                {item.imagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imagePreview}
                      alt="Preview"
                      className="w-full h-44 object-cover rounded-xl border border-[#E8E4DC]"
                    />
                    {item.uploading && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        <Loader2 size={24} className="text-white animate-spin" />
                      </div>
                    )}
                    {!item.uploading && item.uploadedUrl && (
                      <div className="absolute top-2 right-2 bg-emerald-500 rounded-full p-1">
                        <CheckCircle2 size={14} className="text-white" />
                      </div>
                    )}
                    <button
                      onClick={() => updateItem(item.id, { imageFile: null, imagePreview: null, uploadedUrl: null })}
                      className="absolute top-2 left-2 bg-black/50 rounded-full p-1 text-white hover:bg-black/70 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRefs.current[item.id]?.click()}
                    className="w-full h-32 border-2 border-dashed border-[#D4CFC7] rounded-xl flex flex-col items-center justify-center gap-2 text-[#8A877F] hover:border-[#1B4F8A] hover:text-[#1B4F8A] transition-colors"
                  >
                    <Camera size={24} />
                    <span className="text-sm font-medium">Tap to take photo or upload</span>
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className={LABEL}>Description <span className="text-red-400">*</span></label>
                <textarea
                  className={`${INPUT} resize-none`}
                  rows={3}
                  placeholder="Describe the item or issue…"
                  value={item.description}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                />
              </div>

              {/* Quantity */}
              <div>
                <label className={LABEL}>Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                    className="w-10 h-10 rounded-xl border border-[#D4CFC7] flex items-center justify-center text-[#1A1A18] hover:border-[#1B4F8A] transition-colors text-lg font-light"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-lg font-semibold text-[#1A1A18]">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                    className="w-10 h-10 rounded-xl border border-[#D4CFC7] flex items-center justify-center text-[#1A1A18] hover:border-[#1B4F8A] transition-colors text-lg font-light"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add item button */}
        <button
          onClick={() => setItems(prev => [...prev, newItem()])}
          className="w-full py-3 border-2 border-dashed border-[#C4B99A] rounded-2xl flex items-center justify-center gap-2 text-[#8A877F] hover:border-[#1B4F8A] hover:text-[#1B4F8A] transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Add Another Item
        </button>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E4DC] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-center gap-2 py-2 border-b border-[#F0EDE8]">
          <span className="text-[10px] text-[#C4BFB6] uppercase tracking-widest">Powered by</span>
          <Image src="/logo.png" alt="QuotingHub" width={96} height={32} className="h-8 w-auto object-contain opacity-60" />
        </div>
        <div className="p-4">
        {error && (
          <p className="text-xs text-red-500 text-center mb-3">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-[#1B4F8A] text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-[#163d6e] transition-colors disabled:opacity-60 max-w-xl mx-auto"
        >
          {submitting
            ? <><Loader2 size={18} className="animate-spin" /> Sending…</>
            : 'Send Request to R Kaplan Interiors'
          }
        </button>
        </div>
      </div>
    </div>
  )
}
