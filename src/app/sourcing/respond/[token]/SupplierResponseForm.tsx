'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, Package } from 'lucide-react'

interface RequestData {
  id: string
  title: string
  specifications: string | null
  quantity: number
  unit: string | null
  item_quantity: number | null
  dimensions: string | null
  colour_finish: string | null
  status: string
}

interface RecipientData {
  id: string
  supplier_name: string
  status: string
  viewed_at: string | null
  responded_at: string | null
}

interface ResponseData {
  unit_price: number
  lead_time_weeks: number | null
  notes: string | null
  valid_until: string | null
  submitted_at: string
}

interface ImageData {
  id: string
  url: string
  caption: string | null
}

interface Props {
  token: string
  data: {
    request: RequestData
    recipient: RecipientData
    response: ResponseData | null
    images: ImageData[]
    studio_name: string
  }
}

export function SupplierResponseForm({ token, data }: Props) {
  const { request, recipient, response: existingResponse, images, studio_name } = data

  const [unitPrice, setUnitPrice] = useState(existingResponse?.unit_price?.toString() ?? '')
  const [leadTime, setLeadTime] = useState(existingResponse?.lead_time_weeks?.toString() ?? '')
  const [notes, setNotes] = useState(existingResponse?.notes ?? '')
  const [validUntil, setValidUntil] = useState(existingResponse?.valid_until ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const alreadyResponded = ['responded', 'accepted', 'rejected', 'declined'].includes(recipient.status)
  const isDeclined = recipient.status === 'declined'
  const isAccepted = recipient.status === 'accepted'
  const isTerminal = ['cancelled', 'pushed'].includes(request.status)

  // Stamp viewed_at
  useEffect(() => {
    if (!alreadyResponded) {
      fetch(`/api/sourcing/respond/${token}/view`, { method: 'POST' }).catch(() => {})
    }
  }, [token, alreadyResponded])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price <= 0) { setError('Please enter a valid unit price'); return }
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/sourcing/respond/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'respond',
        unit_price: price,
        lead_time_weeks: leadTime ? parseInt(leadTime) : null,
        notes: notes.trim() || null,
        valid_until: validUntil || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSubmitting(false); return }
    setSubmitted(true)
    setSubmitting(false)
  }

  async function handleDecline() {
    if (!confirm('Confirm you are declining to quote for this item?')) return
    setDeclining(true)
    const res = await fetch(`/api/sourcing/respond/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    })
    await res.json()
    setDeclined(true)
    setDeclining(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      {/* Header */}
      <header className="bg-[#2C2C2A] px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-[#C4A46B] uppercase tracking-widest">{studio_name}</p>
          <p className="text-xs text-white/40 mt-0.5">Pricing Request</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Request card */}
        <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
          <div className="px-6 py-5 border-b border-[#EDE9E1]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F5F2EC] flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-[#9A7B4F]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">Item</p>
                <h1 className="text-lg font-bold text-[#1A1A18] leading-tight">{request.title}</h1>
                <p className="text-xs text-[#8A877F] mt-1">Requested by {studio_name}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
            <DetailRow label="Quantity" value={`${request.quantity}${request.unit ? ' ' + request.unit : ''}`} />
            {request.dimensions && <DetailRow label="Dimensions" value={request.dimensions} />}
            {request.colour_finish && <DetailRow label="Colour / Finish" value={request.colour_finish} />}
            {request.specifications && (
              <div className="col-span-2 pt-2 border-t border-[#F5F2EC]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-1.5">Specifications</p>
                <p className="text-sm text-[#2C2C2A] leading-relaxed whitespace-pre-wrap">{request.specifications}</p>
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Reference Images</p>
            <div className="flex flex-wrap gap-3">
              {images.map(img => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.url)}
                  className="w-24 h-24 rounded-lg overflow-hidden border border-[#EDE9E1] hover:border-[#C4A46B] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? ''} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        )}

        {/* Response section */}
        {submitted || declined ? (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8 text-center">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-base font-semibold text-[#2C2C2A] mb-1">
              {declined ? 'Declined to quote' : 'Response submitted'}
            </p>
            <p className="text-sm text-[#8A877F]">
              {declined
                ? `${studio_name} has been notified that you have declined to quote for this item.`
                : `Thank you. ${studio_name} has been notified and will review your response.`}
            </p>
          </div>
        ) : isTerminal ? (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-6 text-center">
            <p className="text-sm font-semibold text-[#2C2C2A] mb-1">Request closed</p>
            <p className="text-sm text-[#8A877F]">This pricing request is no longer accepting responses.</p>
          </div>
        ) : alreadyResponded && !isAccepted ? (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-6 text-center">
            <CheckCircle size={28} className={`mx-auto mb-3 ${isDeclined ? 'text-[#C4BFB5]' : 'text-emerald-500'}`} />
            <p className="text-sm font-semibold text-[#2C2C2A] mb-1">
              {isDeclined ? 'You declined to quote' : 'Response already submitted'}
            </p>
            <p className="text-sm text-[#8A877F]">{studio_name} has been notified.</p>
          </div>
        ) : isAccepted ? (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
            <CheckCircle size={28} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-emerald-800 mb-1">Your response was accepted</p>
            <p className="text-sm text-emerald-700">{studio_name} has selected your quote for this item.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
            <div className="px-6 py-5 border-b border-[#EDE9E1]">
              <h2 className="text-sm font-semibold text-[#2C2C2A]">Submit Your Price</h2>
              <p className="text-xs text-[#8A877F] mt-0.5">
                Dear {recipient.supplier_name} — please fill in your pricing below.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">
                  Unit Price (excl. VAT) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#8A877F] font-medium">R</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    required
                    className="flex-1 px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">
                  Lead Time (weeks)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 6"
                  value={leadTime}
                  onChange={e => setLeadTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">
                  Notes / Conditions
                </label>
                <textarea
                  rows={3}
                  placeholder="Any caveats, material specs, colour options, or special conditions…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">
                  Price valid until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  className="px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting…' : 'Submit Price'}
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={declining}
                  className="px-4 py-2.5 text-sm text-[#8A877F] hover:text-red-500 border border-[#D8D3C8] rounded-lg hover:border-red-300 transition-colors disabled:opacity-50"
                >
                  {declining ? 'Declining…' : 'Decline'}
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-[#C4BFB5] pb-4">
          This is a preliminary pricing request — not a purchase order.
          <br />Powered by <span className="text-[#9A7B4F]">QuotingHub</span>
        </p>
      </main>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">{label}</p>
      <p className="text-sm text-[#2C2C2A]">{value}</p>
    </div>
  )
}
