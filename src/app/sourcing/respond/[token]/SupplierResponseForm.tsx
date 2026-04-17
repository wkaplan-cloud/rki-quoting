'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, Package, PencilLine } from 'lucide-react'

interface RequestData {
  id: string
  title: string
  specifications: string | null
  quantity: number | null
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

function EditableField({
  label, value, original, onChange, type = 'text', placeholder, multiline,
}: {
  label: string; value: string; original: string; onChange: (v: string) => void
  type?: string; placeholder?: string; multiline?: boolean
}) {
  const changed = value.trim() !== original.trim()
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">{label}</label>
        {changed && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-semibold rounded uppercase tracking-wide">
            <PencilLine size={9} /> Modified
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 resize-none transition-colors ${changed ? 'bg-amber-50 border-amber-300 focus:ring-amber-400' : 'bg-[#F5F2EC] border-[#D8D3C8] focus:ring-[#9A7B4F]'}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 transition-colors ${changed ? 'bg-amber-50 border-amber-300 focus:ring-amber-400' : 'bg-[#F5F2EC] border-[#D8D3C8] focus:ring-[#9A7B4F]'}`}
        />
      )}
    </div>
  )
}

export function SupplierResponseForm({ token, data }: Props) {
  const { request, recipient, response: existingResponse, images, studio_name } = data

  const [editTitle, setEditTitle] = useState(request.title)
  const [editFabricQty, setEditFabricQty] = useState(request.quantity?.toString() ?? '')
  const [editFabricUnit, setEditFabricUnit] = useState(request.unit ?? '')
  const [editItemQty, setEditItemQty] = useState(request.item_quantity?.toString() ?? '')
  const [editDimensions, setEditDimensions] = useState(request.dimensions ?? '')
  const [editColour, setEditColour] = useState(request.colour_finish ?? '')
  const [editSpecs, setEditSpecs] = useState(request.specifications ?? '')

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

  const fabricQtyChanged = editFabricQty !== (request.quantity?.toString() ?? '')
  const fabricUnitChanged = editFabricUnit.trim() !== (request.unit ?? '').trim()

  useEffect(() => {
    if (!alreadyResponded) {
      fetch(`/api/sourcing/respond/${token}/view`, { method: 'POST' }).catch(() => {})
    }
  }, [token, alreadyResponded])

  function getChangedFields() {
    const changed: string[] = []
    if (editTitle.trim() !== request.title.trim()) changed.push('title')
    if (fabricQtyChanged) changed.push('fabric_quantity')
    if (fabricUnitChanged) changed.push('fabric_unit')
    if (editItemQty !== (request.item_quantity?.toString() ?? '')) changed.push('item_quantity')
    if (editDimensions.trim() !== (request.dimensions ?? '').trim()) changed.push('dimensions')
    if (editColour.trim() !== (request.colour_finish ?? '').trim()) changed.push('colour_finish')
    if (editSpecs.trim() !== (request.specifications ?? '').trim()) changed.push('specifications')
    return changed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price <= 0) { setError('Please enter a valid unit price'); return }
    setSubmitting(true)
    setError(null)

    const changedFields = getChangedFields()
    const supplierEdits: Record<string, unknown> = {}
    if (changedFields.includes('title')) supplierEdits.title = editTitle.trim()
    if (changedFields.includes('fabric_quantity')) supplierEdits.fabric_quantity = parseFloat(editFabricQty) || null
    if (changedFields.includes('fabric_unit')) supplierEdits.fabric_unit = editFabricUnit.trim() || null
    if (changedFields.includes('item_quantity')) supplierEdits.item_quantity = parseInt(editItemQty) || null
    if (changedFields.includes('dimensions')) supplierEdits.dimensions = editDimensions.trim() || null
    if (changedFields.includes('colour_finish')) supplierEdits.colour_finish = editColour.trim() || null
    if (changedFields.includes('specifications')) supplierEdits.specifications = editSpecs.trim() || null

    const res = await fetch(`/api/sourcing/respond/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'respond',
        unit_price: price,
        lead_time_weeks: leadTime ? parseInt(leadTime) : null,
        notes: notes.trim() || null,
        valid_until: validUntil || null,
        supplier_edits: changedFields.length > 0 ? supplierEdits : null,
        changed_fields: changedFields.length > 0 ? changedFields : null,
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
    await fetch(`/api/sourcing/respond/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    })
    setDeclined(true)
    setDeclining(false)
  }

  const changedCount = getChangedFields().length

  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <header className="bg-[#2C2C2A] px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-[#C4A46B] uppercase tracking-widest">{studio_name}</p>
          <p className="text-xs text-white/40 mt-0.5">Pricing Request</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Editable request details */}
        <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
          <div className="px-6 py-5 border-b border-[#EDE9E1]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F5F2EC] flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-[#9A7B4F]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">Pricing Request from {studio_name}</p>
                <p className="text-xs text-[#8A877F] mt-1 leading-relaxed">
                  Review and edit the fields below if needed. Any changes you make will be flagged for the studio when they review your response.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <EditableField label="Item Name" value={editTitle} original={request.title} onChange={setEditTitle} placeholder="Item name" />

            <div className="grid grid-cols-2 gap-3">
              {/* Fabric quantity — two sub-inputs, one label */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F]">Fabric / Material Qty</span>
                  {(fabricQtyChanged || fabricUnitChanged) && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-semibold rounded uppercase tracking-wide">
                      <PencilLine size={9} /> Modified
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number" min="0" step="any" value={editFabricQty} onChange={e => setEditFabricQty(e.target.value)} placeholder="Qty"
                    className={`w-20 px-2 py-2 text-sm border rounded focus:outline-none focus:ring-1 transition-colors ${fabricQtyChanged ? 'bg-amber-50 border-amber-300 focus:ring-amber-400' : 'bg-[#F5F2EC] border-[#D8D3C8] focus:ring-[#9A7B4F]'}`}
                  />
                  <input
                    type="text" value={editFabricUnit} onChange={e => setEditFabricUnit(e.target.value)} placeholder="Unit"
                    className={`flex-1 px-2 py-2 text-sm border rounded focus:outline-none focus:ring-1 transition-colors ${fabricUnitChanged ? 'bg-amber-50 border-amber-300 focus:ring-amber-400' : 'bg-[#F5F2EC] border-[#D8D3C8] focus:ring-[#9A7B4F]'}`}
                  />
                </div>
              </div>

              <EditableField label="No. of Items" value={editItemQty} original={request.item_quantity?.toString() ?? ''} onChange={setEditItemQty} type="number" placeholder="e.g. 3" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Size / Dimensions" value={editDimensions} original={request.dimensions ?? ''} onChange={setEditDimensions} placeholder="e.g. 2200W × 900D" />
              <EditableField label="Colour / Finish" value={editColour} original={request.colour_finish ?? ''} onChange={setEditColour} placeholder="e.g. Sage green" />
            </div>

            <EditableField label="Description / Specifications" value={editSpecs} original={request.specifications ?? ''} onChange={setEditSpecs} multiline placeholder="Specifications, materials, construction…" />

            {changedCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                You have modified {changedCount} field{changedCount !== 1 ? 's' : ''}. The studio will see exactly what was changed when reviewing your response.
              </p>
            )}
          </div>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-3">Reference Images</p>
            <div className="flex flex-wrap gap-3">
              {images.map(img => (
                <button key={img.id} onClick={() => setSelectedImage(img.url)} className="w-24 h-24 rounded-lg overflow-hidden border border-[#EDE9E1] hover:border-[#C4A46B] transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? ''} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        )}

        {/* Response section */}
        {submitted || declined ? (
          <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8 text-center">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-base font-semibold text-[#2C2C2A] mb-1">{declined ? 'Declined to quote' : 'Response submitted'}</p>
            <p className="text-sm text-[#8A877F]">
              {declined ? `${studio_name} has been notified that you have declined to quote.` : `Thank you. ${studio_name} has been notified and will review your response.`}
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
            <p className="text-sm font-semibold text-[#2C2C2A] mb-1">{isDeclined ? 'You declined to quote' : 'Response already submitted'}</p>
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
              <p className="text-xs text-[#8A877F] mt-0.5">Dear {recipient.supplier_name} — please fill in your pricing below.</p>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Unit Price (excl. VAT) <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#8A877F] font-medium">R</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required
                    className="flex-1 px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Lead Time (weeks)</label>
                <input type="number" min="0" step="1" placeholder="e.g. 6" value={leadTime} onChange={e => setLeadTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Notes / Conditions</label>
                <textarea rows={3} placeholder="Any caveats, material specs, colour options, or special conditions…" value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Price valid until</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  className="px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]" />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Submitting…' : 'Submit Price'}
                </button>
                <button type="button" onClick={handleDecline} disabled={declining}
                  className="px-4 py-2.5 text-sm text-[#8A877F] hover:text-red-500 border border-[#D8D3C8] rounded-lg hover:border-red-300 transition-colors disabled:opacity-50">
                  {declining ? 'Declining…' : 'Decline'}
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-[#C4BFB5] pb-4">
          This is a preliminary pricing request — not a purchase order.<br />
          Powered by <span className="text-[#9A7B4F]">QuotingHub</span>
        </p>
      </main>
    </div>
  )
}
