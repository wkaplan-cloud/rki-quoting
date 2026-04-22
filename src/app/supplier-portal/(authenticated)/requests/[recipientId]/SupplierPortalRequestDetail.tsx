'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Package, Paperclip, X, MessageSquare, Send } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'

interface RequestData {
  id: string
  title: string
  work_type: string | null
  specifications: string | null
  item_quantity: number | null
  dimensions: string | null
  colour_finish: string | null
  status: string
}

interface RecipientData {
  id: string
  supplier_name: string
  status: string
  token: string
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
}

interface ResponseData {
  unit_price: number
  lead_time_weeks: number | null
  notes: string | null
  valid_until: string | null
  submitted_at: string
  supplier_edits?: {
    fabric_quantity?: number
    fabric_unit?: string
    supplier_notes?: string
  } | null
  attachment_url?: string | null
}

interface MessageData {
  id: string
  sender_type: 'designer' | 'supplier'
  body: string
  created_at: string
}

interface Props {
  recipientId: string
  data: {
    request: RequestData
    recipient: RecipientData
    response: ResponseData | null
    images: { id: string; url: string; caption: string | null }[]
    initialMessages: MessageData[]
    studio_name: string
  }
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">{label}</p>
      <p className="text-sm text-[#2C2C2A]">{value}</p>
    </div>
  )
}

export function SupplierPortalRequestDetail({ recipientId, data }: Props) {
  const { request, recipient, response: existingResponse, images, initialMessages, studio_name } = data

  const [fabricQty, setFabricQty] = useState(existingResponse?.supplier_edits?.fabric_quantity?.toString() ?? '')
  const [fabricUnit, setFabricUnit] = useState(existingResponse?.supplier_edits?.fabric_unit ?? '')
  const [supplierNotes, setSupplierNotes] = useState(existingResponse?.supplier_edits?.supplier_notes ?? '')
  const [unitPrice, setUnitPrice] = useState(existingResponse?.unit_price?.toString() ?? '')
  const [leadTime, setLeadTime] = useState(existingResponse?.lead_time_weeks?.toString() ?? '')
  const [validityDays, setValidityDays] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(existingResponse?.attachment_url ?? null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Messaging
  const [messages, setMessages] = useState<MessageData[]>(initialMessages)
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const msgBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/sourcing/respond/${recipient.token}/messages`)
        if (!res.ok) return
        const d = await res.json() as { messages: MessageData[] }
        setMessages(d.messages)
      } catch {}
    }
    const id = setInterval(fetchMessages, 12000)
    return () => clearInterval(id)
  }, [recipient.token])

  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgInput.trim()) return
    setSendingMsg(true)
    setMsgError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${recipient.token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: msgInput.trim() }),
      })
      const d = await res.json() as { message?: MessageData; error?: string }
      if (!res.ok) { setMsgError(d.error ?? 'Failed to send'); return }
      if (d.message) setMessages(prev => [...prev, d.message!])
      setMsgInput('')
    } catch { setMsgError('Failed to send') } finally { setSendingMsg(false) }
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAttachment(true)
    let compressed: File
    try { compressed = await compressImage(file) } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); setUploadingAttachment(false); return }
    setAttachmentFile(compressed)
    const formData = new FormData()
    formData.append('file', compressed)
    const res = await fetch(`/api/sourcing/respond/${recipient.token}/upload`, { method: 'POST', body: formData })
    const json = await res.json() as { url?: string; error?: string }
    setUploadingAttachment(false)
    if (!res.ok) { setError(json.error ?? 'Upload failed'); setAttachmentFile(null); return }
    setAttachmentUrl(json.url ?? null)
  }

  function validUntilDate(days: string): string {
    if (!days) return ''
    const d = new Date()
    d.setDate(d.getDate() + Number(days))
    return d.toISOString().split('T')[0]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price <= 0) { setError('Please enter a valid unit price'); return }
    setSubmitting(true)
    setError(null)
    const supplierEdits: Record<string, unknown> = {}
    if (fabricQty) supplierEdits.fabric_quantity = parseFloat(fabricQty) || null
    if (fabricUnit.trim()) supplierEdits.fabric_unit = fabricUnit.trim()
    if (supplierNotes.trim()) supplierEdits.supplier_notes = supplierNotes.trim()
    const res = await fetch(`/api/supplier-portal/requests/${recipientId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'respond',
        unit_price: price,
        lead_time_weeks: leadTime ? parseInt(leadTime) : null,
        notes: supplierNotes.trim() || null,
        valid_until: validUntilDate(validityDays) || null,
        supplier_edits: Object.keys(supplierEdits).length > 0 ? supplierEdits : null,
        attachment_url: attachmentUrl ?? null,
      }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? null); setSubmitting(false); return }
    setSubmitted(true)
    setSubmitting(false)
  }

  async function handleDecline() {
    if (!confirm('Confirm you are declining to quote for this item?')) return
    setDeclining(true)
    await fetch(`/api/supplier-portal/requests/${recipientId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    })
    setDeclined(true)
    setDeclining(false)
  }

  const alreadyResponded = ['responded', 'accepted', 'rejected', 'declined'].includes(recipient.status)
  const isDeclined = recipient.status === 'declined'
  const isAccepted = recipient.status === 'accepted'
  const isTerminal = ['cancelled', 'pushed'].includes(request.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/supplier-portal/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors">
          <ArrowLeft size={14} />
          All Requests
        </Link>
      </div>

      {/* Item details */}
      <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#EDE9E1]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F5F2EC] flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-[#9A7B4F]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">Price Request from {studio_name}</p>
              <p className="text-base font-semibold text-[#2C2C2A] mt-1">{request.title}</p>
              {request.work_type && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-[#EDE9E1] text-[#6B6860] text-[10px] font-semibold rounded uppercase tracking-wider">
                  {request.work_type}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
          <DetailRow label="Size / Dimensions" value={request.dimensions} />
          <DetailRow label="Quantity of Items" value={request.item_quantity} />
          <DetailRow label="Colour / Finish" value={request.colour_finish} />
          {request.specifications && (
            <div className="col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A877F] mb-0.5">Description / Notes</p>
              <p className="text-sm text-[#2C2C2A] leading-relaxed">{request.specifications}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reference images */}
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

      {/* Messages */}
      <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EDE9E1] flex items-center gap-2">
          <MessageSquare size={14} className="text-[#9A7B4F]" />
          <p className="text-sm font-semibold text-[#2C2C2A]">Messages with {studio_name}</p>
          {messages.length > 0 && (
            <span className="ml-auto text-xs text-[#8A877F]">{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-[#C4BFB5] text-center py-3">No messages yet. Ask a question about this request.</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_type === 'designer' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.sender_type === 'designer'
                    ? 'bg-[#F5F2EC] border border-[#EDE9E1] text-[#2C2C2A] rounded-tl-sm'
                    : 'bg-[#2C2C2A] text-[#F5F2EC] rounded-tr-sm'
                }`}>
                  <div className={`text-[9px] font-semibold mb-0.5 ${m.sender_type === 'designer' ? 'text-[#9A7B4F]' : 'text-white/50'}`}>
                    {m.sender_type === 'designer' ? studio_name : 'You'}
                  </div>
                  {m.body}
                  <div className={`text-[9px] mt-1 ${m.sender_type === 'designer' ? 'text-[#C4BFB5]' : 'text-white/40'}`}>
                    {new Date(m.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{new Date(m.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={msgBottomRef} />
        </div>
        {msgError && <p className="px-4 pb-2 text-xs text-red-500">{msgError}</p>}
        <form onSubmit={handleSendMessage} className="px-4 pb-4 flex gap-2">
          <input
            type="text"
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            placeholder={`Message ${studio_name}…`}
            className="flex-1 px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]"
          />
          <button type="submit" disabled={sendingMsg || !msgInput.trim()}
            className="px-3 py-2 bg-[#2C2C2A] text-white rounded text-sm font-medium hover:bg-[#9A7B4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <Send size={13} />
          </button>
        </form>
      </div>

      {/* Response section */}
      {submitted || declined ? (
        <div className="bg-white rounded-2xl border border-[#EDE9E1] p-8 text-center">
          <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-base font-semibold text-[#2C2C2A] mb-1">{declined ? 'Declined to quote' : 'Response submitted'}</p>
          <p className="text-sm text-[#8A877F]">
            {declined ? `${studio_name} has been notified.` : `Thank you. ${studio_name} will review your response.`}
          </p>
          <Link href="/supplier-portal/dashboard" className="inline-block mt-4 text-sm text-[#9A7B4F] hover:underline">← Back to all requests</Link>
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
          <p className="text-sm text-emerald-700">{studio_name} selected your quote for this item.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier details */}
          <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EDE9E1]">
              <p className="text-sm font-semibold text-[#2C2C2A]">Your Details</p>
              <p className="text-xs text-[#8A877F] mt-0.5">Dear {recipient.supplier_name} — fill in the information below.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Fabric / Material Quantity Needed</label>
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" placeholder="e.g. 5" value={fabricQty} onChange={e => setFabricQty(e.target.value)}
                    className="w-28 px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]" />
                  <input type="text" placeholder="Unit (e.g. metres)" value={fabricUnit} onChange={e => setFabricUnit(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Notes</label>
                <textarea rows={3} placeholder="Material specs, colour options, caveats…" value={supplierNotes} onChange={e => setSupplierNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F] resize-none" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-[#EDE9E1] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EDE9E1]">
              <p className="text-sm font-semibold text-[#2C2C2A]">Your Price</p>
            </div>
            <div className="px-6 py-5 space-y-4">
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
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Attach Quote / Document <span className="text-[#8A877F] font-normal">(optional)</span></label>
                {attachmentFile ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#F5F2EC] border border-[#D8D3C8] rounded">
                    <Paperclip size={13} className="text-[#9A7B4F] flex-shrink-0" />
                    <span className="text-sm text-[#2C2C2A] truncate flex-1">{attachmentFile.name}</span>
                    {uploadingAttachment
                      ? <span className="text-xs text-[#8A877F]">Uploading…</span>
                      : <button type="button" onClick={() => { setAttachmentFile(null); setAttachmentUrl(null) }} className="text-[#8A877F] hover:text-red-500 transition-colors flex-shrink-0"><X size={13} /></button>
                    }
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 bg-[#F5F2EC] border border-[#D8D3C8] border-dashed rounded cursor-pointer hover:bg-[#EDE9E1] transition-colors">
                    <Paperclip size={13} className="text-[#8A877F]" />
                    <span className="text-sm text-[#8A877F]">Click to attach a file (PDF, image, etc.)</span>
                    <input ref={attachmentInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={handleAttachmentChange} />
                  </label>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2A] mb-1.5">Price valid for</label>
                <select value={validityDays} onChange={e => setValidityDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F5F2EC] border border-[#D8D3C8] rounded focus:outline-none focus:ring-1 focus:ring-[#9A7B4F]">
                  <option value="">Select validity period</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3">
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
      )}
    </div>
  )
}
