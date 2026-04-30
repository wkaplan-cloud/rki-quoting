'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Upload, FileText, X, AlertTriangle, Ban, Download, Printer } from 'lucide-react'
import { CATEGORIES, CATEGORY_FIELDS, type CategoryKey } from '@/lib/sourcing-categories'

function ImageLightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowRight') setCurrent(i => (i + 1) % urls.length)
    if (e.key === 'ArrowLeft') setCurrent(i => (i - 1 + urls.length) % urls.length)
  }, [onClose, urls.length])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  function handleDownload() {
    const a = document.createElement('a')
    a.href = urls[current]
    a.download = `reference-${current + 1}.jpg`
    a.target = '_blank'
    a.click()
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Reference Image</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#000}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${urls[current]}" onload="window.print();window.close()"/></body></html>`)
    win.document.close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      {/* Top toolbar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {urls.length > 1 ? `${current + 1} / ${urls.length}` : 'Reference image'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            title="Print"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <Printer size={14} />
            Print
          </button>
          <button
            onClick={handleDownload}
            title="Save image"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <Download size={14} />
            Save
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Prev/Next arrows */}
      {urls.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setCurrent(i => (i - 1 + urls.length) % urls.length) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); setCurrent(i => (i + 1) % urls.length) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            ›
          </button>
        </>
      )}

      {/* Image */}
      <div onClick={e => e.stopPropagation()} className="flex items-center justify-center px-16 py-20 max-w-5xl w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[current]}
          alt={`Reference ${current + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          style={{ userSelect: 'none' }}
        />
      </div>

      {/* Dot indicators */}
      {urls.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={e => e.stopPropagation()}>
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ background: i === current ? '#fff' : 'rgba(255,255,255,0.35)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface Assignment {
  id: string
  status: string
  responded_at: string | null
  pending_supplier_specs: Record<string, string> | null
  spec_approval_status: string | null
  item: {
    id: string
    title: string
    work_type: string | null
    specifications: string | null
    item_quantity: number | null
    dimensions: string | null
    colour_finish: string | null
    ref_image_urls: string[] | null
    category: string | null
    item_specs: Record<string, string> | null
  } | null
  response: {
    id: string
    unit_price: number
    fabric_quantity: number | null
    fabric_unit: string | null
    lead_time_weeks: number | null
    valid_until: string | null
    notes: string | null
    supplier_specs: Record<string, string> | null
  } | null
}

interface Props {
  token: string
  sessionSupplierId: string
  supplierName: string
  sessionTitle: string
  projectName: string | null
  studioName: string
  assignments: Assignment[]
  showBackLink?: boolean
}

const INPUT = {
  background: '#27272A',
  border: '1px solid #3F3F46',
  color: '#FAFAFA',
}

function PriceForm({
  assignment,
  token,
  onSaved,
  onDeclined,
  onSpecApprovalRequested,
}: {
  assignment: Assignment
  token: string
  onSaved: (assignmentId: string, response: Assignment['response']) => void
  onDeclined: (assignmentId: string) => void
  onSpecApprovalRequested: (assignmentId: string, specs: Record<string, string>) => void
}) {
  const [expanded, setExpanded] = useState(!assignment.response)
  const [cantSupply, setCantSupply] = useState(assignment.status === 'supplier_declined')
  const [cantReason, setCantReason] = useState('')
  const [unitPrice, setUnitPrice] = useState(assignment.response?.unit_price?.toString() ?? '')
  const [leadTime, setLeadTime] = useState(assignment.response?.lead_time_weeks?.toString() ?? '')
  const [notes, setNotes] = useState(assignment.response?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specEdits, setSpecEdits] = useState<Record<string, string>>(() => {
    const it = assignment.item
    if (!it) return {}
    if (assignment.response?.supplier_specs) return assignment.response.supplier_specs
    const init: Record<string, string> = { ...(it.item_specs ?? {}) }
    if (it.dimensions) init.dimensions = it.dimensions
    if (it.colour_finish) init.colour_finish = it.colour_finish
    return init
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitPrice || isNaN(Number(unitPrice))) {
      setError('Please enter a valid unit price')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          unit_price: Number(unitPrice),
          lead_time_weeks: leadTime ? Number(leadTime) : null,
          notes: notes.trim() || null,
          supplier_specs: Object.keys(specEdits).length > 0 ? specEdits : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onSaved(assignment.id, json.data)
      setExpanded(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCantSupply() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id, reason: cantReason.trim() || undefined }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      onDeclined(assignment.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  async function handleSendForApproval() {
    setSendingApproval(true)
    setError(null)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/spec-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignment.id, specs: specEdits }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onSpecApprovalRequested(assignment.id, specEdits)
      setExpanded(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSendingApproval(false)
    }
  }

  const item = assignment.item
  if (!item) return null

  const catKey = (item.category ?? 'general') as CategoryKey
  const fieldDefs = CATEGORY_FIELDS[catKey] ?? []
  const catLabel = CATEGORIES.find(c => c.key === catKey)?.label

  const origSpecs: Record<string, string> = {
    ...(item.item_specs ?? {}),
    ...(item.dimensions ? { dimensions: item.dimensions } : {}),
    ...(item.colour_finish ? { colour_finish: item.colour_finish } : {}),
  }
  const specsChanged = Object.keys({ ...origSpecs, ...specEdits }).some(
    k => (specEdits[k] ?? '') !== (origSpecs[k] ?? '')
  )
  const specApproved = assignment.spec_approval_status === 'approved'
  const specRejected = assignment.spec_approval_status === 'rejected'

  const lightbox = lightboxIndex !== null && item.ref_image_urls && item.ref_image_urls.length > 0
    ? <ImageLightbox urls={item.ref_image_urls} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
    : null

  // Amber locked tile — spec changes awaiting designer approval
  if (assignment.spec_approval_status === 'pending') {
    const pending = assignment.pending_supplier_specs ?? {}
    return <>{lightbox}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <div className="px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm mb-0.5" style={{ color: '#18181B' }}>{item.title}</p>
            <p className="text-xs" style={{ color: '#92600A' }}>Spec changes sent — awaiting designer approval before you can price</p>
            {Object.keys(pending).length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(pending).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: '#A1A1AA' }}>{k.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-medium" style={{ color: '#52525B' }}>{v || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5" style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
            Pending
          </span>
        </div>
      </div>
    </>
  }

  // Locked red tile — supplier can't supply this item
  if (assignment.status === 'supplier_declined') {
    return <>{lightbox}
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
        <Ban size={16} className="text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#18181B' }}>{item.title}</p>
          {assignment.response?.notes?.replace("[CAN'T SUPPLY] ", '') ? (
            <p className="text-xs text-red-600 mt-0.5">{assignment.response.notes.replace("[CAN'T SUPPLY] ", '')}</p>
          ) : (
            <p className="text-xs text-red-400 mt-0.5">Marked as can&apos;t supply</p>
          )}
        </div>
        <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full shrink-0">Can&apos;t supply</span>
      </div>
    </>
  }

  // Locked green tile — designer accepted this price
  if (assignment.status === 'accepted') {
    return <>{lightbox}
      <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{ background: '#F0FDF4', border: '1px solid #A7F3D0' }}>
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#18181B' }}>{item.title}</p>
          <p className="text-sm text-emerald-700 font-medium mt-0.5">
            R{assignment.response?.unit_price.toLocaleString()} accepted
            {assignment.response?.lead_time_weeks ? ` · ${assignment.response.lead_time_weeks}w lead` : ''}
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full shrink-0">Accepted</span>
      </div>
    </>
  }

  return (
    <>
    {lightbox}
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: expanded ? '#FAFAFA' : 'transparent' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#FAFAFA' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {assignment.response && !cantSupply && (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            )}
            <p className="font-semibold text-sm truncate" style={{ color: '#18181B' }}>{item.title}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {item.work_type && <span className="text-xs" style={{ color: '#71717A' }}>{item.work_type}</span>}
            {item.item_quantity && <span className="text-xs" style={{ color: '#71717A' }}>Qty: {item.item_quantity}</span>}
            {item.dimensions && <span className="text-xs" style={{ color: '#71717A' }}>{item.dimensions}</span>}
            {item.colour_finish && <span className="text-xs" style={{ color: '#71717A' }}>{item.colour_finish}</span>}
          </div>
          {item.ref_image_urls && item.ref_image_urls.length > 0 && !expanded && (
            <div className="flex gap-1.5 mt-2">
              {item.ref_image_urls.slice(0, 3).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i} src={url} alt=""
                  className="w-10 h-10 rounded-md object-cover cursor-pointer transition-opacity hover:opacity-80"
                  style={{ border: '1px solid #E4E4E7' }}
                  onClick={e => { e.stopPropagation(); setLightboxIndex(i) }}
                />
              ))}
              {item.ref_image_urls.length > 3 && (
                <button
                  onClick={e => { e.stopPropagation(); setLightboxIndex(3) }}
                  className="w-10 h-10 rounded-md flex items-center justify-center text-xs font-medium transition-colors hover:bg-[#E4E4E7]"
                  style={{ background: '#F4F4F5', color: '#71717A', border: '1px solid #E4E4E7' }}
                >
                  +{item.ref_image_urls.length - 3}
                </button>
              )}
            </div>
          )}
          {assignment.response && !expanded && !cantSupply && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              R{assignment.response.unit_price.toLocaleString()} submitted
              {assignment.response.lead_time_weeks ? ` · ${assignment.response.lead_time_weeks}w lead` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 mt-0.5" style={{ color: '#A1A1AA' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #E4E4E7' }}>
          {(item.ref_image_urls?.length || fieldDefs.length > 0 || item.dimensions != null || item.colour_finish != null || item.specifications) ? (
            <div style={{ background: '#FAFAFA', borderBottom: '1px solid #E4E4E7' }}>
              {/* Reference images */}
              {item.ref_image_urls && item.ref_image_urls.length > 0 && (
                <div className="px-5 pt-3 pb-2 flex gap-2 flex-wrap">
                  {item.ref_image_urls.map((url, i) => (
                    <button key={i} type="button" onClick={() => setLightboxIndex(i)} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Reference ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border transition-opacity group-hover:opacity-80" style={{ borderColor: '#E4E4E7' }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Specs section — editable normally, read-only when approved */}
              {(fieldDefs.length > 0 || catKey === 'general' || item.dimensions != null || item.colour_finish != null) && (
                <div className="px-5 pt-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#A1A1AA' }}>
                      {catLabel && catKey !== 'general' ? `${catLabel} specs` : 'Item details'}
                    </p>
                    {specApproved && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                        Approved
                      </span>
                    )}
                    {!specApproved && specsChanged && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: '#FEF9EC', color: '#92600A', border: '1px solid #F6D07A' }}>
                        Edited
                      </span>
                    )}
                  </div>
                  {specApproved ? (
                    // Read-only approved specs
                    <div className="grid grid-cols-2 gap-2">
                      {(() => {
                        const approved = assignment.pending_supplier_specs ?? {}
                        const allKeys = [...fieldDefs.map(f => f.key), ...(item.dimensions != null ? ['dimensions'] : []), ...(item.colour_finish != null ? ['colour_finish'] : [])]
                        return allKeys.map(key => {
                          const fieldDef = fieldDefs.find(f => f.key === key)
                          const label = fieldDef ? `${fieldDef.label}${fieldDef.unit ? ` (${fieldDef.unit})` : ''}` : key.replace(/_/g, ' ')
                          const isTextarea = fieldDef?.type === 'textarea'
                          return (
                            <div key={key} className={isTextarea ? 'col-span-2' : ''}>
                              <p className="text-[10px] mb-0.5" style={{ color: '#71717A' }}>{label}</p>
                              <p className="text-xs font-medium px-2 py-1.5 rounded-lg" style={{ background: '#F0FDF4', color: '#18181B', border: '1px solid #A7F3D0' }}>
                                {approved[key] || '—'}
                              </p>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  ) : (
                    // Editable inputs
                    <div className="grid grid-cols-2 gap-2">
                      {fieldDefs.map(field => {
                        const val = specEdits[field.key] ?? ''
                        const inputStyle = { background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }
                        if (field.type === 'select') return (
                          <div key={field.key}>
                            <label className="block text-[10px] mb-0.5" style={{ color: '#71717A' }}>{field.label}</label>
                            <select value={val} onChange={e => setSpecEdits(p => ({ ...p, [field.key]: e.target.value }))}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none" style={inputStyle}>
                              <option value="">—</option>
                              {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        )
                        if (field.type === 'textarea') return (
                          <div key={field.key} className="col-span-2">
                            <label className="block text-[10px] mb-0.5" style={{ color: '#71717A' }}>{field.label}</label>
                            <textarea value={val} onChange={e => setSpecEdits(p => ({ ...p, [field.key]: e.target.value }))}
                              rows={2} placeholder={field.placeholder}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none resize-none" style={inputStyle} />
                          </div>
                        )
                        return (
                          <div key={field.key}>
                            <label className="block text-[10px] mb-0.5" style={{ color: '#71717A' }}>
                              {field.label}{field.unit && <span style={{ color: '#A1A1AA' }}> ({field.unit})</span>}
                            </label>
                            <input type={field.type === 'number' ? 'number' : 'text'} value={val}
                              onChange={e => setSpecEdits(p => ({ ...p, [field.key]: e.target.value }))}
                              placeholder={field.placeholder ?? ''}
                              className="w-full px-2 py-1.5 text-xs rounded-lg outline-none" style={inputStyle} />
                          </div>
                        )
                      })}
                      {(item.dimensions != null || catKey === 'general') && (
                        <div>
                          <label className="block text-[10px] mb-0.5" style={{ color: '#71717A' }}>Dimensions</label>
                          <input value={specEdits.dimensions ?? ''} onChange={e => setSpecEdits(p => ({ ...p, dimensions: e.target.value }))}
                            placeholder={item.dimensions ?? 'e.g. 1200 × 800 mm'}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }} />
                        </div>
                      )}
                      {(item.colour_finish != null || catKey === 'general') && (
                        <div>
                          <label className="block text-[10px] mb-0.5" style={{ color: '#71717A' }}>Colour / Finish</label>
                          <input value={specEdits.colour_finish ?? ''} onChange={e => setSpecEdits(p => ({ ...p, colour_finish: e.target.value }))}
                            placeholder={item.colour_finish ?? 'e.g. Matt white'}
                            className="w-full px-2 py-1.5 text-xs rounded-lg outline-none"
                            style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }} />
                        </div>
                      )}
                    </div>
                  )}
                  {!specApproved && specsChanged && (
                    <p className="text-[10px] mt-2" style={{ color: '#A1A1AA' }}>Spec changes require designer approval — use the button below to send.</p>
                  )}
                </div>
              )}

              {/* Notes / specifications text (read-only from designer) */}
              {item.specifications && (
                <div className="px-5 pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#A1A1AA' }}>Notes from studio</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#52525B' }}>{item.specifications}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Can't supply toggle */}
          <div className="px-5 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer w-fit">
              <div
                onClick={() => setCantSupply(v => !v)}
                className={`w-9 h-5 rounded-full flex items-center transition-colors ${cantSupply ? 'bg-red-400' : 'bg-[#E4E4E7]'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${cantSupply ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-medium" style={{ color: cantSupply ? '#EF4444' : '#71717A' }}>
                Can&apos;t supply this item
              </span>
            </label>
          </div>

          {cantSupply ? (
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>
                  Reason (optional)
                </label>
                <textarea
                  value={cantReason}
                  onChange={e => setCantReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Out of stock, discontinued, outside our scope…"
                  className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                  style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setCantSupply(false)}
                  className="px-4 py-2 text-sm rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: '#71717A', border: '1px solid #E4E4E7' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleCantSupply} disabled={saving}
                  className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: '#EF4444', color: '#FFFFFF' }}>
                  {saving ? 'Saving…' : 'Confirm can\'t supply'}
                </button>
              </div>
            </div>
          ) : specsChanged && !specApproved ? (
            /* Specs edited but not yet approved — show send-for-approval CTA */
            <div className="px-5 py-4 space-y-3">
              {specRejected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-600">Previous spec request was rejected — revise and re-send.</p>
                </div>
              )}
              {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
              <button type="button" onClick={handleSendForApproval} disabled={sendingApproval}
                className="w-full px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                style={{ background: '#78350F', color: '#FFFFFF' }}>
                {sendingApproval ? 'Sending…' : 'Send specs for approval'}
              </button>
            </div>
          ) : (
            /* Normal price form — no spec changes, or specs already approved */
            <>
              {specApproved && (
                <div className="px-5 pt-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <p className="text-xs font-medium text-emerald-700">Spec changes approved — enter your price below</p>
                  </div>
                </div>
              )}
              {specRejected && !specsChanged && (
                <div className="px-5 pt-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                    <AlertTriangle size={13} className="text-red-400 shrink-0" />
                    <p className="text-xs text-red-600">Spec changes rejected — you can price with the original specs or edit and re-send.</p>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>
                      Unit Price (excl. VAT) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#A1A1AA' }}>R</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitPrice}
                        onChange={e => setUnitPrice(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-7 pr-3 py-2.5 text-sm rounded-lg outline-none"
                        style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Lead Time (weeks)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={leadTime}
                      onChange={e => setLeadTime(e.target.value)}
                      placeholder="e.g. 6"
                      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#71717A' }}>Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any conditions, exclusions, or comments…"
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none"
                    style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#18181B' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#71717A')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#E4E4E7')}
                  />
                </div>
                {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                    style={{ background: '#34495E', color: '#FFFFFF' }}
                  >
                    {saving ? 'Saving…' : assignment.response ? 'Update Price' : 'Submit Price'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
    </>
  )
}

function QuoteUpload({ token, locked }: { token: string; locked?: boolean }) {
  const [uploads, setUploads] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/sourcing/respond/${token}/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUploads(prev => [...prev, { name: file.name, url: json.url }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
      <div className="px-5 py-3" style={{ borderBottom: '1px solid #E4E4E7' }}>
        <p className="text-sm font-semibold" style={{ color: '#18181B' }}>Upload Quote</p>
        <p className="text-xs mt-0.5" style={{ color: '#A1A1AA' }}>Attach your formal quote document (PDF, Excel, etc.)</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {uploads.map((u, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: '#F4F4F5' }}>
            <FileText size={14} style={{ color: '#71717A' }} className="shrink-0" />
            <a href={u.url} target="_blank" rel="noopener noreferrer"
              className="text-sm flex-1 truncate hover:underline" style={{ color: '#18181B' }}>
              {u.name}
            </a>
            <button onClick={() => setUploads(prev => prev.filter((_, j) => j !== i))}
              className="shrink-0 transition-opacity hover:opacity-60" style={{ color: '#A1A1AA' }}>
              <X size={13} />
            </button>
          </div>
        ))}
        {locked ? (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm opacity-40 cursor-not-allowed select-none"
            style={{ background: '#F4F4F5', color: '#71717A', border: '1px dashed #D4D4D8' }}>
            <Upload size={14} />
            Upload locked — pricing accepted
          </div>
        ) : (
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-opacity ${uploading ? 'opacity-50 pointer-events-none' : 'hover:opacity-80'}`}
            style={{ background: '#F4F4F5', color: '#71717A', border: '1px dashed #D4D4D8' }}>
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Choose file'}
            <input type="file" className="hidden" onChange={handleFile} disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg" />
          </label>
        )}
        {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
      </div>
    </div>
  )
}


export function SupplierRespondClient({
  token,
  sessionSupplierId,
  supplierName,
  sessionTitle,
  projectName,
  studioName,
  assignments,
  showBackLink = false,
}: Props) {
  const [items, setItems] = useState(assignments)
  const [declining, setDeclining] = useState(false)
  const [fullyDeclined, setFullyDeclined] = useState(false)

  const allAccepted = items.length > 0 && items.every(a => a.status === 'accepted')

  function handleSaved(assignmentId: string, response: Assignment['response']) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, status: 'responded', response } : a)
    )
  }

  function handleDeclined(assignmentId: string) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId ? { ...a, status: 'supplier_declined' } : a)
    )
  }

  function handleSpecApprovalRequested(assignmentId: string, specs: Record<string, string>) {
    setItems(prev =>
      prev.map(a => a.id === assignmentId
        ? { ...a, spec_approval_status: 'pending', pending_supplier_specs: specs }
        : a
      )
    )
  }

  async function handleDeclineAll() {
    if (!window.confirm('Decline this entire price request? The designer will be notified.')) return
    setDeclining(true)
    try {
      const res = await fetch(`/api/sourcing/respond/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      setFullyDeclined(true)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeclining(false)
    }
  }

  const responded = items.filter(a => a.response && a.status !== 'supplier_declined').length
  const total = items.length
  const allDone = responded === total && total > 0

  if (fullyDeclined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F4F5' }}>
        <div className="text-center px-6 py-12">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#FFF1F2' }}>
            <Ban size={22} className="text-red-400" />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: '#18181B' }}>Request declined</p>
          <p className="text-sm" style={{ color: '#71717A' }}>The design studio has been notified.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F4F5' }}>
      {/* Header — only shown for standalone (unauthenticated) token access */}
      {showBackLink && (
        <div style={{ background: '#27272A' }}>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="QuotingHub" className="h-6 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.6)' }} />
              <a
                href="/supplier-portal"
                className="text-xs font-medium transition-opacity hover:opacity-60"
                style={{ color: '#71717A' }}
              >
                Supplier Portal →
              </a>
            </div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#71717A' }}>Pricing Request</p>
            <p className="text-lg font-semibold" style={{ color: '#FAFAFA' }}>{sessionTitle}</p>
            {projectName && <p className="text-sm mt-0.5" style={{ color: '#A1A1AA' }}>{projectName}</p>}
            <p className="text-xs mt-2" style={{ color: '#52525B' }}>From {studioName} · To {supplierName}</p>
          </div>
        </div>
      )}

      {/* Session info — shown in portal context instead of dark header */}
      {!showBackLink && (
        <div className="px-6 pt-6">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#A1A1AA' }}>Pricing Request</p>
          <h1 className="text-lg font-semibold" style={{ color: '#18181B' }}>{sessionTitle}</h1>
          {projectName && <p className="text-sm mt-0.5" style={{ color: '#71717A' }}>{projectName}</p>}
          <p className="text-xs mt-1" style={{ color: '#A1A1AA' }}>From {studioName} · To {supplierName}</p>
        </div>
      )}

      {showBackLink ? (
        /* ── Standalone / email view — narrow single column ── */
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {allDone ? (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div>
                {allAccepted ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-800">Pricing accepted</p>
                    <p className="text-xs text-emerald-600">The studio has accepted your quotes. No further action needed.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-emerald-800">All prices submitted</p>
                    <p className="text-xs text-emerald-600">Awaiting review from the studio.</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-3.5 rounded-xl flex items-center justify-between" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
              <p className="text-sm" style={{ color: '#18181B' }}>
                <span className="font-semibold">{responded} of {total}</span> item{total !== 1 ? 's' : ''} priced
              </p>
              <div className="flex-1 mx-6 rounded-full h-1.5 overflow-hidden" style={{ background: '#E4E4E7' }}>
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%`, background: '#34495E' }} />
              </div>
            </div>
          )}
          <div className="space-y-3">
            {items.map(assignment => (
              <PriceForm key={assignment.id} assignment={assignment} token={token} onSaved={handleSaved} onDeclined={handleDeclined} onSpecApprovalRequested={handleSpecApprovalRequested} />
            ))}
          </div>
          <QuoteUpload token={token} locked={allAccepted} />
          {!allAccepted && (
            <div className="pt-2 border-t border-[#E4E4E7]">
              <button type="button" onClick={handleDeclineAll} disabled={declining}
                className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40 mx-auto"
                style={{ color: '#EF4444' }}>
                <AlertTriangle size={13} />
                {declining ? 'Declining…' : 'Decline entire request'}
              </button>
            </div>
          )}
          <div className="rounded-xl px-5 py-4 text-center" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#18181B' }}>Manage all your requests in one place</p>
            <p className="text-xs mb-3" style={{ color: '#71717A' }}>Create a free supplier account to track pricing requests, submit prices, and message studios — without needing a link each time.</p>
            <a
              href="/supplier-portal/register"
              className="inline-block text-xs font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: '#2C2C2A', color: '#F5F2EC' }}
            >
              Create free account →
            </a>
            <p className="text-xs mt-2" style={{ color: '#A1A1AA' }}>Already have an account? <a href="/supplier-portal" style={{ color: '#9A7B4F', textDecoration: 'none' }}>Sign in</a></p>
          </div>
          <p className="text-center text-xs pb-4" style={{ color: '#A1A1AA' }}>Sent via QuotingHub</p>
        </div>
      ) : (
        /* ── Portal view — full width 2-column ── */
        <div className="px-4 py-6">
          <div className="mb-4">
            {allDone ? (
              <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">All prices submitted</p>
                  <p className="text-xs text-emerald-600">You can still update individual prices or send a message.</p>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3.5 rounded-xl flex items-center justify-between" style={{ background: '#FFFFFF', border: '1px solid #E4E4E7' }}>
                <p className="text-sm" style={{ color: '#18181B' }}>
                  <span className="font-semibold">{responded} of {total}</span> item{total !== 1 ? 's' : ''} priced
                </p>
                <div className="flex-1 mx-6 rounded-full h-1.5 overflow-hidden" style={{ background: '#E4E4E7' }}>
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (responded / total) * 100 : 0}%`, background: '#34495E' }} />
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
            <div className="space-y-3">
              {items.map(assignment => (
                <PriceForm key={assignment.id} assignment={assignment} token={token} onSaved={handleSaved} onDeclined={handleDeclined} onSpecApprovalRequested={handleSpecApprovalRequested} />
              ))}
            </div>
            <div className="space-y-4">
              <QuoteUpload token={token} locked={allAccepted} />
              {!allAccepted && (
                <div className="pt-2 border-t border-[#E4E4E7]">
                  <button type="button" onClick={handleDeclineAll} disabled={declining}
                    className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40 mx-auto"
                    style={{ color: '#EF4444' }}>
                    <AlertTriangle size={13} />
                    {declining ? 'Declining…' : 'Decline entire request'}
                  </button>
                </div>
              )}
              <p className="text-center text-xs pb-2" style={{ color: '#A1A1AA' }}>Sent via QuotingHub</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
