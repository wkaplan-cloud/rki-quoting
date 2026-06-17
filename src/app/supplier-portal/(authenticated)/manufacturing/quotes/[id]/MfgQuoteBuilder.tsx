'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fmtR } from '@/lib/mfg-format'
import {
  Plus, Trash2, Check, AlertTriangle, Save,
  Send, FileDown, RefreshCw, ArrowLeft, Copy, Loader2, Archive, X
} from 'lucide-react'
import type { MfgPriceBookItem, MfgSettings, MfgLineItemTemplateFull, MfgQuoteLineItemDraft, MfgCostComponentDraft } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5', bg: '#F5F7F9' }

const fmt = fmtR

function calcLineItem(li: MfgQuoteLineItemDraft): MfgQuoteLineItemDraft {
  const markup = li.markup_percentage / 100
  const compCost    = li.components.reduce((sum, c) => {
    if (c.unit_cost === null || c.unit_cost === undefined) return sum
    return sum + (c.unit_cost * c.quantity)
  }, 0)
  const compSelling = compCost * (1 + markup)
  const labourCost    = (li.labour_hours ?? 0) * (li.labour_rate ?? 0)
  const labourSelling = labourCost * (1 + markup)
  const costPerUnit   = compCost + labourCost
  const unitPrice     = compSelling + labourSelling
  const lineTotal     = unitPrice * li.quantity
  const profitPerUnit = unitPrice - costPerUnit
  const marginPct     = unitPrice > 0 ? (profitPerUnit / unitPrice) * 100 : 0
  return { ...li, cost_per_unit: costPerUnit, unit_price: unitPrice, line_total: lineTotal, profit_per_unit: profitPerUnit, margin_percentage: marginPct }
}

function hasPending(li: MfgQuoteLineItemDraft) {
  return li.components.some(c => c.supplier_quoted && (c.unit_cost === null || c.unit_cost === undefined))
}

const BLANK_LINE = (markup: number): MfgQuoteLineItemDraft => ({
  sort_order: 0, description: '', callout_note: '', quantity: 1,
  unit_price: 0, line_total: 0, markup_percentage: markup,
  cost_per_unit: 0, profit_per_unit: 0, margin_percentage: 0,
  option_label: null, labour_hours: 0, labour_rate: 0,
  components: [], cost_builder_open: false,
})


const DEFAULT_COMPONENT_CATEGORY = { material: 'boards', hardware: 'hinges_rails' } as const

function PriceBookSelect({ items, onSelect, placeholder }: {
  items: MfgPriceBookItem[]
  onSelect: (item: MfgPriceBookItem) => void
  placeholder: string
}) {
  const [q, setQ] = useState('')
  const filtered = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="relative">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-xs rounded-lg outline-none"
        style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
      {q && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {filtered.map(item => (
            <button key={item.id} onClick={() => { onSelect(item); setQ('') }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 text-left">
              <span style={{ color: S.text }}>{item.name}</span>
              <span style={{ color: S.muted }}>
                {item.supplier_quoted ? '⚠ per quote' : (item.cost_price != null ? fmtR(item.cost_price) : 'R —')} /{item.unit === 'custom' ? item.unit_custom : item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  quote: { id: string; quote_number: string; revision_number: number; status: string; job_id: string; apply_vat: boolean; vat_rate: number; show_unit_price: boolean; valid_until: string | null; notes: string | null; total: number; subtotal: number; vat_amount: number; total_cost: number; total_profit: number; delivery_cost?: number; installation_cost?: number; job?: { id: string; job_name: string; client?: { client_name: string; email: string | null } | null } | null }
  initialLineItems: MfgQuoteLineItemDraft[]
  priceBook: MfgPriceBookItem[]
  settings: MfgSettings | null
  templates: MfgLineItemTemplateFull[]
  revisions: { id: string; revision_number: number; status: string; created_at: string }[]
}

export function MfgQuoteBuilder({ quote, initialLineItems, priceBook: initialPriceBook, settings, templates, revisions }: Props) {
  const router = useRouter()
  const defaultMarkup = settings?.default_markup_percentage ?? 30

  const [priceBook, setPriceBook] = useState<MfgPriceBookItem[]>(initialPriceBook)

  const [lineItems, setLineItems] = useState<MfgQuoteLineItemDraft[]>(
    initialLineItems.length ? initialLineItems.map(li => ({ ...li, cost_builder_open: false })) : []
  )
  const [costBuilderModal, setCostBuilderModal] = useState<number | null>(null)
  const [applyVat, setApplyVat]     = useState(quote.apply_vat)
  const [vatRate] = useState(quote.vat_rate)
  const [saving, setSaving]       = useState(false)
  const [sending, setSending]     = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [error, setError]         = useState('')
  const autoSaveTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef     = useRef(true)
  const pbTimers       = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [pbSaved, setPbSaved] = useState<Set<string>>(new Set())
  const [deliveryCost, setDeliveryCost]         = useState(quote.delivery_cost ?? 0)
  const [installationCost, setInstallationCost] = useState(quote.installation_cost ?? 0)
  const deliveryTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const deliveryMountRef  = useRef(true)

  const PB_UNITS = ['sheet','plank','meter','piece','litre','kg','custom'] as const
  type PbUnit = typeof PB_UNITS[number]

  interface CustomFormState {
    name: string; pbUnit: PbUnit; unitCustom: string; qty: string; cost: string
    saveToPb: boolean; supplierQuoted: boolean
    pbType: 'material' | 'hardware'; saving: boolean
  }
  const BLANK_CUSTOM = (): CustomFormState => ({
    name: '', pbUnit: 'piece', unitCustom: '', qty: '1', cost: '',
    saveToPb: true, supplierQuoted: false, pbType: 'material', saving: false,
  })
  const [showCustomForm, setShowCustomForm] = useState<{ liIdx: number } | null>(null)
  const [customForm, setCustomForm] = useState<CustomFormState>(BLANK_CUSTOM())

  function openCustomForm(liIdx: number) {
    setShowCustomForm({ liIdx })
    setCustomForm(BLANK_CUSTOM())
  }

  async function submitCustom() {
    if (!showCustomForm) return
    const { liIdx } = showCustomForm
    if (!customForm.name.trim()) return
    if (customForm.pbUnit === 'custom' && !customForm.unitCustom.trim()) return
    setCustomForm(f => ({ ...f, saving: true }))
    const displayUnit = customForm.pbUnit === 'custom' ? customForm.unitCustom.trim() : customForm.pbUnit
    let pbItemId: string | null = null
    if (customForm.saveToPb) {
      const res = await fetch('/api/supplier-portal/manufacturing/price-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type:       customForm.pbType,
          category:        DEFAULT_COMPONENT_CATEGORY[customForm.pbType],
          name:            customForm.name.trim(),
          unit:            customForm.pbUnit,
          unit_custom:     customForm.pbUnit === 'custom' ? customForm.unitCustom.trim() : null,
          cost_price:      customForm.supplierQuoted ? null : (customForm.cost ? parseFloat(customForm.cost) : null),
          supplier_quoted: customForm.supplierQuoted,
        }),
      })
      if (res.ok) {
        const saved = await res.json() as MfgPriceBookItem
        pbItemId = saved.id ?? null
        setPriceBook(prev => [...prev, saved])
      }
    }
    const comp: MfgCostComponentDraft = {
      _type:              customForm.pbType,
      price_book_item_id: pbItemId,
      item_name:          customForm.name.trim(),
      unit:               displayUnit,
      quantity:           parseFloat(customForm.qty) || 1,
      unit_cost:          customForm.supplierQuoted ? null : (customForm.cost ? parseFloat(customForm.cost) : null),
      supplier_quoted:    customForm.supplierQuoted,
      sort_order:         lineItems[liIdx].components.length,
    }
    updateLineItem(liIdx, { components: [...lineItems[liIdx].components, comp] })
    setShowCustomForm(null)
  }

  const [currentStatus, setCurrentStatus] = useState(quote.status)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [sendSuccess, setSendSuccess] = useState(false)
  const [markingSent, setMarkingSent] = useState(false)
  const [markingAccepted, setMarkingAccepted] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertType, setConvertType] = useState<'full' | 'deposit'>('deposit')
  const [converting, setConverting] = useState(false)

  const itemsSubtotal = lineItems.reduce((s, li) => s + li.line_total, 0)
  const grossSubtotal = itemsSubtotal + deliveryCost + installationCost
  const vatAmt        = applyVat ? grossSubtotal * (vatRate / 100) : 0
  const total         = grossSubtotal + vatAmt
  const totalCost     = lineItems.reduce((s, li) => s + li.cost_per_unit * li.quantity, 0)
  const totalProfit   = itemsSubtotal - totalCost
  const totalMargin   = itemsSubtotal > 0 ? (totalProfit / itemsSubtotal) * 100 : 0
  const hasPendingItems = lineItems.some(hasPending)

  useEffect(() => {
    if (isReadOnly) return
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { void handleSave(true) }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, applyVat])

  useEffect(() => {
    if (isReadOnly) return
    if (deliveryMountRef.current) { deliveryMountRef.current = false; return }
    clearTimeout(deliveryTimerRef.current)
    deliveryTimerRef.current = setTimeout(() => {
      void patchQuoteField({ delivery_cost: deliveryCost, installation_cost: installationCost })
    }, 1000)
    return () => clearTimeout(deliveryTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryCost, installationCost])

  function updateLineItem(idx: number, updates: Partial<MfgQuoteLineItemDraft>) {
    setLineItems(prev => {
      const next = [...prev]
      next[idx] = calcLineItem({ ...next[idx], ...updates })
      return next
    })
  }

  function addLineItem() {
    setLineItems(prev => [
      ...prev,
      { ...BLANK_LINE(defaultMarkup), sort_order: prev.length },
    ])
  }

  function toggleOptionItem(idx: number) {
    setLineItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], option_label: next[idx].option_label ? null : 'Optional' }
      return next
    })
  }

  function removeLineItem(idx: number) {
    setCostBuilderModal(null)
    setLineItems(prev => prev.filter((_, i) => i !== idx).map((li, i) => ({ ...li, sort_order: i })))
  }

  function duplicateLineItem(idx: number) {
    setLineItems(prev => {
      const src = prev[idx]
      const clone = { ...src, id: undefined, description: src.description ? `${src.description} (copy)` : '', cost_builder_open: false, components: src.components.map(c => ({ ...c, id: undefined })) }
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next.map((li, i) => ({ ...li, sort_order: i }))
    })
  }

  function loadTemplate(idx: number, template: MfgLineItemTemplateFull) {
    const components: MfgCostComponentDraft[] = [
      ...template.materials.map((m, i) => {
        const pb = priceBook.find(p => p.id === m.price_book_item_id)
        return { _type: 'material' as const, price_book_item_id: m.price_book_item_id, item_name: m.item_name, unit: m.unit, quantity: m.quantity, unit_cost: pb?.supplier_quoted ? null : (pb?.cost_price ?? null), supplier_quoted: pb?.supplier_quoted ?? false, sort_order: i }
      }),
      ...template.hardware.map((h, i) => {
        const pb = priceBook.find(p => p.id === h.price_book_item_id)
        return { _type: 'hardware' as const, price_book_item_id: h.price_book_item_id, item_name: h.item_name, unit: h.unit, quantity: h.quantity, unit_cost: pb?.supplier_quoted ? null : (pb?.cost_price ?? null), supplier_quoted: pb?.supplier_quoted ?? false, sort_order: template.materials.length + i }
      }),
    ]
    updateLineItem(idx, { description: template.description ?? '', callout_note: template.callout_note ?? '', markup_percentage: template.default_markup_percentage, components })
  }

  function addComponent(liIdx: number, item: MfgPriceBookItem) {
    const comp: MfgCostComponentDraft = {
      _type: item.item_type, price_book_item_id: item.id,
      item_name: item.name,
      unit: item.unit === 'custom' ? (item.unit_custom ?? item.unit) : item.unit,
      quantity: 1, unit_cost: item.supplier_quoted ? null : (item.cost_price ?? null),
      supplier_quoted: item.supplier_quoted, sort_order: lineItems[liIdx].components.length,
    }
    updateLineItem(liIdx, { components: [...lineItems[liIdx].components, comp] })
  }

  function handleUnitCostChange(liIdx: number, compIdx: number, newCost: number | null) {
    const comps = [...lineItems[liIdx].components]
    const comp = comps[compIdx]
    comps[compIdx] = { ...comp, unit_cost: newCost }
    updateLineItem(liIdx, { components: comps })
    if (!comp.price_book_item_id || comp.supplier_quoted || newCost === null) return
    const pbId = comp.price_book_item_id
    clearTimeout(pbTimers.current[pbId])
    pbTimers.current[pbId] = setTimeout(async () => {
      await fetch(`/api/supplier-portal/manufacturing/price-book/${pbId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost_price: newCost }) })
      setPbSaved(prev => { const s = new Set(prev); s.add(pbId); return s })
      setTimeout(() => setPbSaved(prev => { const s = new Set(prev); s.delete(pbId); return s }), 2000)
    }, 1000)
  }

  async function handleArchive() {
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/archive`, { method: 'POST' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Archive failed')
      setConfirmArchive(false)
      return
    }
    router.push('/supplier-portal/manufacturing/quotes')
  }

  async function patchQuoteField(fields: Record<string, unknown>) {
    await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
  }



  const handleSave = useCallback(async (quiet = false) => {
    if (!quiet) setSaving(true)
    setError('')
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/line-items`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_items: lineItems }),
    })
    if (!quiet) setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Save failed'); return false }
    if (!quiet) { setSaveFeedback('Saved'); setTimeout(() => setSaveFeedback(''), 2000) }
    return true
  }, [quote.id, lineItems])

  function openSendModal() {
    const clientName   = quote.job?.client?.client_name ?? 'Client'
    const jobName      = quote.job?.job_name ?? ''
    const businessName = settings?.business_name ?? ''
    const validUntil   = quote.valid_until
      ? new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
      : '30 days from date of issue'
    setSendEmail(quote.job?.client?.email ?? '')
    setSendBody(
      (settings?.email_template_quote
        ?.replace('{client_name}', clientName)
        ?.replace('{job_name}', jobName)
        ?.replace('{doc_number}', quote.quote_number)
        ?.replace('{valid_until}', validUntil)
      ) ?? `Dear ${clientName},\n\nPlease find attached your quotation for the ${jobName} project.\n\nThis quote is valid until ${validUntil}.\n\nDon't hesitate to reach out if you have any questions.\n\nKind regards\n${businessName}`
    )
    setShowSendModal(true)
  }

  async function handleSend() {
    if (!sendEmail.trim()) return
    setSending(true)
    await handleSave(true)
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sendEmail.trim(), body: sendBody }),
    })
    setSending(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Send failed'); return }
    setSendSuccess(true)
    setCurrentStatus('sent')
  }

  async function handleMarkSent() {
    setMarkingSent(true)
    const now = new Date().toISOString()
    await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'sent', sent_at: now }) })
    setMarkingSent(false)
    setCurrentStatus('sent')
    setShowSendModal(false)
  }

  async function handleMarkAccepted() {
    setMarkingAccepted(true)
    const today = new Date().toISOString().split('T')[0]
    await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'accepted', acceptance_date: today }) })
    setMarkingAccepted(false)
    setCurrentStatus('accepted')
  }

  async function handleRevision() {
    setCreatingRevision(true)
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/revision`, { method: 'POST' })
    setCreatingRevision(false)
    if (!res.ok) return
    const d = await res.json()
    router.push(`/supplier-portal/manufacturing/quotes/${d.id}`)
  }

  async function handleConvert() {
    setConverting(true)
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/convert`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_type: convertType, deposit_percentage: settings?.default_deposit_percentage ?? 50 }),
    })
    setConverting(false)
    if (!res.ok) return
    setShowConvertModal(false)
    router.push('/supplier-portal/manufacturing/invoices')
  }

  const isReadOnly = currentStatus === 'invoiced' || currentStatus === 'superseded'
  const latestRevision = revisions[revisions.length - 1]
  const isArchivable = ['draft', 'sent', 'accepted', 'declined', 'expired', 'superseded'].includes(currentStatus)
  const [confirmArchive, setConfirmArchive] = useState(false)

  function renderLineItem(li: MfgQuoteLineItemDraft, liIdx: number) {
    const pending = hasPending(li)
    const isOption = !!li.option_label
    return (
      <div key={liIdx} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${pending ? '#FDE68A' : isOption ? '#D1FAE5' : S.border}`, background: S.card }}>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold mt-2 flex-shrink-0 w-6 text-center rounded-full py-0.5"
              style={{ background: '#EFF6FF', color: S.accent }}>
              {liIdx + 1}
            </span>
            <div className="flex-1 space-y-3">
              <textarea
                value={li.description}
                onChange={e => updateLineItem(liIdx, { description: e.target.value })}
                placeholder="Describe the item (e.g. Floor-to-ceiling wardrobe unit in walnut veneer with soft-close hinges and LED strip)"
                rows={2} disabled={isReadOnly}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none transition-colors"
                style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
              />
              <input
                value={li.callout_note ?? ''}
                onChange={e => updateLineItem(liIdx, { callout_note: e.target.value })}
                placeholder="⚠ Callout note (printed in red on PDF)"
                disabled={isReadOnly}
                className="w-full px-3 py-2 text-xs rounded-lg outline-none transition-colors"
                style={{ background: S.input, border: `1.5px solid ${S.border}`, color: '#DC2626' }}
              />
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: S.muted }}>Qty</label>
                  <input type="number" min={1} step={1} value={li.quantity}
                    onChange={e => updateLineItem(liIdx, { quantity: parseFloat(e.target.value) || 1 })}
                    disabled={isReadOnly}
                    className="w-20 px-2 py-1 text-sm rounded-lg outline-none text-center"
                    style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: S.muted }}>Unit price</label>
                  <span className="text-sm font-semibold px-3 py-1 rounded-lg" style={{ background: '#EFF6FF', color: S.accent }}>
                    {pending ? '⚠ pending' : fmt(li.unit_price)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: S.muted }}>Line total</label>
                  <span className="text-sm font-bold" style={{ color: S.text }}>
                    {pending ? '—' : fmt(li.line_total)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-1">
              {/* Top row: template + icon actions */}
              <div className="flex items-center gap-1">
                {templates.length > 0 && !isReadOnly && (
                  <div className="relative group">
                    <button className="p-1.5 rounded-lg text-xs flex items-center gap-1"
                      style={{ color: S.muted, background: S.input }}>
                      <Copy size={12} /> Template
                    </button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 rounded-xl shadow-lg overflow-hidden min-w-[200px]"
                      style={{ background: S.card, border: `1px solid ${S.border}` }}>
                      {templates.map(t => (
                        <button key={t.id} onClick={() => loadTemplate(liIdx, t)}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors"
                          style={{ color: S.text }}>
                          {t.template_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!isReadOnly && (
                  <>
                    <button onClick={() => duplicateLineItem(liIdx)} title="Duplicate"
                      className="p-1.5 rounded-lg transition-colors" style={{ color: S.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = S.accent)}
                      onMouseLeave={e => (e.currentTarget.style.color = S.muted)}>
                      <Copy size={14} />
                    </button>
                    <button onClick={() => removeLineItem(liIdx)}
                      className="p-1.5 rounded-lg transition-colors" style={{ color: S.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = S.muted)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              {/* Build cost + Option pill */}
              <div className="flex items-center gap-1">
                <button onClick={() => setCostBuilderModal(liIdx)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: S.accent, background: '#EFF6FF' }}>
                  Build cost →
                </button>
                {!isReadOnly && (
                  <button onClick={() => toggleOptionItem(liIdx)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: isOption ? '#D1FAE5' : S.input,
                      color: isOption ? '#065F46' : S.muted,
                      border: `1px solid ${isOption ? '#6EE7B7' : S.border}`,
                    }}>
                    {isOption ? '✓ Optional' : 'Option'}
                  </button>
                )}
              </div>
              {/* Margin — sits directly below Build cost + Option */}
              {li.margin_percentage > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full self-start" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                  {li.margin_percentage.toFixed(1)}% · {fmt(li.profit_per_unit * li.quantity)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <button onClick={() => router.push('/supplier-portal/manufacturing/quotes')}
            className="flex items-center gap-1 text-xs mb-2 transition-opacity hover:opacity-70"
            style={{ color: S.muted }}>
            <ArrowLeft size={12} /> Back to Quotes
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: S.text }}>{quote.quote_number}</h1>
            {quote.revision_number > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#EFF6FF', color: S.accent }}>v{quote.revision_number}</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
              style={{
                background: currentStatus === 'accepted' ? '#DCFCE7' : currentStatus === 'sent' ? '#FEF3C7' : '#F4F4F5',
                color: currentStatus === 'accepted' ? '#16A34A' : currentStatus === 'sent' ? '#D97706' : S.muted,
              }}>
              {currentStatus}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>
            {quote.job?.client?.client_name && <span className="font-medium">{quote.job.client.client_name} · </span>}
            {quote.job?.job_name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {revisions.length > 1 && (
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
              {revisions.map(r => (
                <button key={r.id} onClick={() => r.id !== quote.id && router.push(`/supplier-portal/manufacturing/quotes/${r.id}`)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{ background: r.id === quote.id ? S.accent : S.card, color: r.id === quote.id ? '#fff' : S.muted }}>
                  v{r.revision_number}
                </button>
              ))}
            </div>
          )}
          {!isReadOnly && (
            <>
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.muted }}>
                {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                  : saveFeedback ? <><Check size={12} style={{ color: '#16A34A' }} /><span style={{ color: '#16A34A' }}>Saved</span></>
                  : <><Save size={12} /> Auto-saves</>}
              </div>
              {(currentStatus === 'draft' || currentStatus === 'sent') && (
                <button onClick={openSendModal}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: S.accent }}>
                  <Send size={12} /> Send Quote
                </button>
              )}
              {currentStatus === 'sent' && (
                <button onClick={() => void handleMarkAccepted()} disabled={markingAccepted}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: '#16A34A' }}>
                  <Check size={12} /> {markingAccepted ? 'Marking…' : 'Mark as Accepted'}
                </button>
              )}
              {(currentStatus === 'sent' || currentStatus === 'accepted') && (
                <button onClick={handleRevision} disabled={creatingRevision}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                  <RefreshCw size={12} /> New Revision
                </button>
              )}
              {currentStatus === 'accepted' && (
                <button onClick={() => setShowConvertModal(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: '#16A34A' }}>
                  <Check size={12} /> Convert to Invoice
                </button>
              )}
            </>
          )}
          <a href={`/api/supplier-portal/manufacturing/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
            <FileDown size={12} /> PDF
          </a>
          {isArchivable && (
            confirmArchive ? (
              <div className="flex items-center gap-1">
                <button onClick={() => void handleArchive()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  Confirm archive
                </button>
                <button onClick={() => setConfirmArchive(false)} className="px-2 py-1.5 rounded-lg text-xs" style={{ color: S.muted }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmArchive(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.muted }}>
                <Archive size={12} /> Archive
              </button>
            )
          )}
        </div>
      </div>

      {currentStatus === 'superseded' && latestRevision && latestRevision.id !== quote.id && (
        <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: '#F4F4F5', border: '1px solid #E4E4E7', color: '#71717A' }}>
          <span>This revision has been superseded. You are viewing a read-only copy.</span>
          <button onClick={() => router.push(`/supplier-portal/manufacturing/quotes/${latestRevision.id}`)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: S.accent, color: '#fff' }}>
            Go to v{latestRevision.revision_number} →
          </button>
        </div>
      )}

      {error && <p className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}
      {hasPendingItems && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
          <AlertTriangle size={14} /> Some line items have pending supplier quotes. Fill in prices before sending.
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-3 mb-4">
        {lineItems.map((li, i) => renderLineItem(li, i))}
        {!isReadOnly && (
          <button onClick={() => addLineItem()}
            className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ background: S.card, border: `1.5px dashed ${S.border}`, color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted }}>
            <Plus size={15} /> Add Line Item
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="space-y-2 max-w-sm ml-auto">
          {totalCost > 0 && (
            <>
              <div className="flex justify-between text-xs pb-2" style={{ borderBottom: `1px dashed ${S.border}` }}>
                <span style={{ color: S.muted }}>Total cost (line items)</span>
                <span style={{ color: S.text }}>{fmtR(totalCost)}</span>
              </div>
              <div className="flex justify-between text-xs pb-2" style={{ borderBottom: `1px solid ${S.border}` }}>
                <span style={{ color: '#16A34A' }}>Total profit ({totalMargin.toFixed(1)}%)</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>{fmtR(totalProfit)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span style={{ color: S.muted }}>Items subtotal</span>
            <span style={{ color: S.text }}>{fmtR(itemsSubtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span style={{ color: S.muted }}>Delivery</span>
            {isReadOnly ? <span style={{ color: S.text }}>{fmtR(deliveryCost)}</span> : (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: S.muted }}>R</span>
                <input type="number" min={0} step={1} value={deliveryCost}
                  onChange={e => setDeliveryCost(parseFloat(e.target.value) || 0)}
                  className="w-28 px-2 py-0.5 text-sm rounded-lg outline-none text-right"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span style={{ color: S.muted }}>Installation</span>
            {isReadOnly ? <span style={{ color: S.text }}>{fmtR(installationCost)}</span> : (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: S.muted }}>R</span>
                <input type="number" min={0} step={1} value={installationCost}
                  onChange={e => setInstallationCost(parseFloat(e.target.value) || 0)}
                  className="w-28 px-2 py-0.5 text-sm rounded-lg outline-none text-right"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
              </div>
            )}
          </div>
          {(deliveryCost > 0 || installationCost > 0) && (
            <div className="flex justify-between text-sm pt-1" style={{ borderTop: `1px dashed ${S.border}` }}>
              <span style={{ color: S.muted }}>Subtotal</span>
              <span style={{ color: S.text }}>{fmtR(grossSubtotal)}</span>
            </div>
          )}
          {applyVat && (
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>VAT ({vatRate}%)</span>
              <span style={{ color: S.text }}>{fmtR(vatAmt)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: `2px solid ${S.border}` }}>
            <span style={{ color: S.text }}>Total</span>
            <span style={{ color: S.text }}>{fmtR(total)}</span>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-2 mt-4 text-xs" style={{ color: S.muted }}>
            {saving && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
            {!saving && saveFeedback && <><Check size={12} style={{ color: '#16A34A' }} /><span style={{ color: '#16A34A' }}>Saved</span></>}
            {!saving && !saveFeedback && <span>Changes save automatically</span>}
          </div>
        )}
      </div>

      {/* Cost Builder Modal */}
      {costBuilderModal !== null && (() => {
        const liIdx = costBuilderModal
        const li = lineItems[liIdx]
        if (!li) return null
        const pending = hasPending(li)
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: S.card }}>
              {/* Modal header */}
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: S.muted }}>Cost build — item {liIdx + 1}</p>
                <p className="text-sm font-medium" style={{ color: S.text }}>{li.description || 'Untitled item'}</p>
              </div>
              {/* Modal body */}
              <div className="px-5 py-5 space-y-5">
                {/* Markup */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Markup</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} step={1} value={li.markup_percentage}
                      onChange={e => updateLineItem(liIdx, { markup_percentage: parseFloat(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className="w-20 px-2 py-1 text-sm rounded-lg outline-none text-center"
                      style={{ background: li.markup_percentage !== defaultMarkup ? '#FEF3C7' : S.input, border: `1.5px solid ${li.markup_percentage !== defaultMarkup ? '#FDE68A' : S.border}`, color: S.text }} />
                    <span className="text-sm" style={{ color: S.muted }}>%</span>
                    {li.markup_percentage !== defaultMarkup && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>custom</span>
                    )}
                  </div>
                </div>

                {/* Components */}
                <div>
                  {li.components.length > 0 && (
                    <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${S.border}` }}>
                      {li.components.map((c, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2 px-3 py-2 text-xs"
                          style={{ background: c.supplier_quoted ? '#FFFBEB' : S.card, borderTop: cIdx > 0 ? `1px solid ${S.border}` : undefined }}>
                          <span className="flex-1 truncate font-medium" style={{ color: S.text }}>{c.item_name}</span>
                          <input type="number" min={1} step={1} value={c.quantity}
                            onChange={e => {
                              const comps = [...li.components]
                              comps[cIdx] = { ...comps[cIdx], quantity: parseFloat(e.target.value) || 1 }
                              updateLineItem(liIdx, { components: comps })
                            }}
                            disabled={isReadOnly}
                            className="w-16 px-2 py-0.5 rounded text-center outline-none"
                            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                          <span style={{ color: S.muted }}>{c.unit}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px]" style={{ color: S.muted }}>R</span>
                            <input type="number" min={0} step={1} value={c.unit_cost ?? ''} placeholder="price"
                              onChange={e => handleUnitCostChange(liIdx, cIdx, e.target.value === '' ? null : parseFloat(e.target.value))}
                              disabled={isReadOnly}
                              className="w-20 px-2 py-0.5 rounded outline-none text-right"
                              style={{
                                background: c.supplier_quoted ? '#FEF3C7' : S.input,
                                border: `1px solid ${c.price_book_item_id && pbSaved.has(c.price_book_item_id) ? '#16A34A' : c.supplier_quoted ? '#FDE68A' : S.border}`,
                                color: c.supplier_quoted ? '#92400E' : S.text,
                              }} />
                            {c.price_book_item_id && pbSaved.has(c.price_book_item_id) && (
                              <span className="text-[9px]" style={{ color: '#16A34A' }}>✓</span>
                            )}
                          </div>
                          <span className="w-16 text-right font-semibold" style={{ color: S.text }}>
                            {c.unit_cost ? fmtR(c.unit_cost * c.quantity) : '—'}
                          </span>
                          {!isReadOnly && (
                            <button onClick={() => updateLineItem(liIdx, { components: li.components.filter((_, i) => i !== cIdx) })}
                              style={{ color: S.muted }}><Trash2 size={11} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <PriceBookSelect items={priceBook} onSelect={item => addComponent(liIdx, item)} placeholder="+ Search components…" />
                      </div>
                      <button onClick={() => openCustomForm(liIdx)}
                        className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                        style={{ color: S.muted, background: S.input, border: `1px solid ${S.border}` }}
                        onMouseEnter={e => { e.currentTarget.style.color = S.accent; e.currentTarget.style.borderColor = S.accent }}
                        onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.borderColor = S.border }}>
                        + custom
                      </button>
                    </div>
                  )}
                </div>

                {/* Labour */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Labour</span>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={0} step={1} value={li.labour_hours ?? 0}
                      onChange={e => updateLineItem(liIdx, { labour_hours: parseFloat(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className="w-20 px-2 py-1.5 text-sm rounded-lg outline-none text-center"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                    <span className="text-xs" style={{ color: S.muted }}>hrs</span>
                  </div>
                  <span className="text-xs" style={{ color: S.muted }}>@</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: S.muted }}>R</span>
                    <input type="number" min={0} step={1} value={li.labour_rate ?? 0}
                      onChange={e => updateLineItem(liIdx, { labour_rate: parseFloat(e.target.value) || 0 })}
                      disabled={isReadOnly}
                      className="w-28 px-2 py-1.5 text-sm rounded-lg outline-none"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                    <span className="text-xs" style={{ color: S.muted }}>/hr</span>
                  </div>
                  {(li.labour_hours ?? 0) > 0 && (li.labour_rate ?? 0) > 0 && (
                    <span className="ml-auto text-xs font-semibold" style={{ color: S.text }}>
                      = {fmtR((li.labour_hours ?? 0) * (li.labour_rate ?? 0))}
                    </span>
                  )}
                </div>

                {/* Cost summary */}
                {(li.components.length > 0 || (li.labour_hours ?? 0) > 0) && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap" style={{ borderTop: `1px solid ${S.border}` }}>
                    <span className="text-xs" style={{ color: S.muted }}>Cost {fmtR(li.cost_per_unit)}</span>
                    <span className="text-xs" style={{ color: S.border }}>→</span>
                    <span className="text-xs font-semibold" style={{ color: S.text }}>
                      Selling {pending ? '—' : fmt(li.unit_price)}
                    </span>
                    {li.profit_per_unit > 0 && (
                      <>
                        <span className="text-xs" style={{ color: S.border }}>·</span>
                        <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>
                          {fmt(li.profit_per_unit)} profit ({li.margin_percentage.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
                <button onClick={() => setCostBuilderModal(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: S.accent }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add Custom Component Modal */}
      {showCustomForm && (() => {
        const canSave = customForm.name.trim() !== '' && !(customForm.pbUnit === 'custom' && !customForm.unitCustom.trim())
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowCustomForm(null)}>
            <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold" style={{ color: S.text }}>Add Custom Component</h3>
                <button onClick={() => setShowCustomForm(null)} style={{ color: S.muted }}><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Type</label>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                    {(['material', 'hardware'] as const).map(t => (
                      <button key={t} onClick={() => setCustomForm(f => ({ ...f, pbType: t }))}
                        className="flex-1 py-2 text-xs font-semibold capitalize transition-colors"
                        style={{ background: customForm.pbType === t ? S.accent : S.card, color: customForm.pbType === t ? '#fff' : S.muted }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Name</label>
                  <input value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. 18mm Oak Veneer MDF" autoFocus
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                    style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Unit</label>
                    <select value={customForm.pbUnit} onChange={e => setCustomForm(f => ({ ...f, pbUnit: e.target.value as PbUnit }))}
                      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                      <option value="piece">Piece</option>
                      <option value="sheet">Sheet</option>
                      <option value="plank">Plank</option>
                      <option value="meter">Meter</option>
                      <option value="litre">Litre</option>
                      <option value="kg">Kg</option>
                      <option value="custom">Custom…</option>
                    </select>
                  </div>
                  {customForm.pbUnit === 'custom' ? (
                    <div className="flex-1">
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Custom unit</label>
                      <input value={customForm.unitCustom} onChange={e => setCustomForm(f => ({ ...f, unitCustom: e.target.value }))}
                        placeholder="e.g. m², pair"
                        className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                        style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Qty</label>
                      <input type="number" min={1} step={1} value={customForm.qty}
                        onChange={e => setCustomForm(f => ({ ...f, qty: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                        style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                    </div>
                  )}
                </div>
                {customForm.pbUnit === 'custom' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Qty</label>
                    <input type="number" min={0.01} step={0.01} value={customForm.qty}
                      onChange={e => setCustomForm(f => ({ ...f, qty: e.target.value }))}
                      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setCustomForm(f => ({ ...f, supplierQuoted: !f.supplierQuoted }))}
                      className="relative rounded-full transition-colors flex-shrink-0"
                      style={{ background: customForm.supplierQuoted ? S.accent : S.border, width: 36, height: 20 }}>
                      <div className="absolute top-0.5 transition-transform rounded-full bg-white shadow"
                        style={{ width: 16, height: 16, left: 2, transform: customForm.supplierQuoted ? 'translateX(16px)' : 'translateX(0)' }} />
                    </div>
                    <span className="text-sm" style={{ color: S.text }}>Price varies — enter per quote</span>
                  </label>
                </div>
                {!customForm.supplierQuoted && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Cost Price (R)</label>
                    <input type="number" min={0} step={1} value={customForm.cost}
                      onChange={e => setCustomForm(f => ({ ...f, cost: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setCustomForm(f => ({ ...f, saveToPb: !f.saveToPb }))}
                      className="relative rounded-full transition-colors flex-shrink-0"
                      style={{ background: customForm.saveToPb ? S.accent : S.border, width: 36, height: 20 }}>
                      <div className="absolute top-0.5 transition-transform rounded-full bg-white shadow"
                        style={{ width: 16, height: 16, left: 2, transform: customForm.saveToPb ? 'translateX(16px)' : 'translateX(0)' }} />
                    </div>
                    <span className="text-sm" style={{ color: S.text }}>Save to price book for future quotes</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => void submitCustom()} disabled={!canSave || customForm.saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  <Check size={14} /> {customForm.saving ? 'Adding…' : 'Add Component'}
                </button>
                <button onClick={() => setShowCustomForm(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowSendModal(false); setSendSuccess(false) }}>
          <div className="rounded-2xl p-6 w-full max-w-lg shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            {sendSuccess ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#DCFCE7' }}>
                  <Check size={28} style={{ color: '#16A34A' }} />
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: S.text }}>Quote sent!</h3>
                <p className="text-sm mb-6" style={{ color: S.muted }}>Delivered to <span className="font-medium" style={{ color: S.text }}>{sendEmail}</span></p>
                <button onClick={() => { setShowSendModal(false); setSendSuccess(false) }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>Close</button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold mb-5" style={{ color: S.text }}>Send Quote</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Send to</label>
                    <input value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="client@email.com" type="email"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Email body</label>
                    <textarea value={sendBody} onChange={e => setSendBody(e.target.value)} rows={8}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-y"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text, lineHeight: '1.6' }} />
                    <p className="text-[10px] mt-1" style={{ color: S.muted }}>The PDF is attached automatically.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-5 flex-wrap">
                  <button onClick={() => void handleSend()} disabled={sending || !sendEmail.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: S.accent }}>
                    <Send size={14} /> {sending ? 'Sending…' : 'Send with PDF'}
                  </button>
                  <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: S.muted }}>Cancel</button>
                  <button onClick={() => void handleMarkSent()} disabled={markingSent}
                    className="ml-auto text-xs disabled:opacity-50" style={{ color: S.muted }}>
                    {markingSent ? 'Marking…' : 'Mark as sent without emailing →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }}>
            <h3 className="text-base font-bold mb-2" style={{ color: S.text }}>Convert to Invoice</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>How would you like to invoice this job?</p>
            <div className="space-y-3">
              {(['full','deposit'] as const).map(t => (
                <label key={t} className="flex items-start gap-3 p-4 rounded-xl cursor-pointer"
                  style={{ background: convertType === t ? '#EFF6FF' : S.input, border: `1.5px solid ${convertType === t ? S.accent : 'transparent'}` }}
                  onClick={() => setConvertType(t)}>
                  <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center"
                    style={{ background: convertType === t ? S.accent : S.border }}>
                    {convertType === t && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: S.text }}>
                      {t === 'full' ? `Full invoice — ${fmt(total)}` : `Deposit first — ${fmt(total * (settings?.default_deposit_percentage ?? 50) / 100)} now (${settings?.default_deposit_percentage ?? 50}%)`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                      {t === 'full' ? 'One invoice for the total amount.' : 'Deposit invoice now, final invoice when job is complete.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleConvert} disabled={converting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#16A34A' }}>
                <Check size={14} /> {converting ? 'Creating…' : 'Create Invoice'}
              </button>
              <button onClick={() => setShowConvertModal(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
