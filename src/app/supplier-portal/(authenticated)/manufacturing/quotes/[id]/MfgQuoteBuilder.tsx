'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronDown, ChevronUp, Check, AlertTriangle, Save,
  Send, FileDown, RefreshCw, ArrowLeft, Eye, EyeOff, Copy, Loader2
} from 'lucide-react'
import type { MfgPriceBookItem, MfgSettings, MfgLineItemTemplateFull, MfgQuoteLineItemDraft, MfgCostMaterialDraft, MfgCostHardwareDraft } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5', bg: '#F5F7F9' }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function calcLineItem(li: MfgQuoteLineItemDraft): MfgQuoteLineItemDraft {
  const markup = li.markup_percentage / 100
  // Materials cost — supplier_quoted items are included once a price is entered
  const matCost = li.materials.reduce((sum, m) => {
    if (m.unit_cost === null || m.unit_cost === undefined) return sum
    return sum + (m.unit_cost * m.quantity)
  }, 0)
  // Hardware cost — split by markup flag, include supplier_quoted once price is entered
  const hwMarkupCost = li.hardware.reduce((sum, h) => {
    if (h.unit_cost === null || h.unit_cost === undefined || !h.apply_markup) return sum
    return sum + (h.unit_cost * h.quantity)
  }, 0)
  const hwAtCost = li.hardware.reduce((sum, h) => {
    if (h.unit_cost === null || h.unit_cost === undefined || h.apply_markup) return sum
    return sum + (h.unit_cost * h.quantity)
  }, 0)
  const costPerUnit = matCost + hwMarkupCost + hwAtCost
  const sellingMatAndMarkupHw = (matCost + hwMarkupCost) * (1 + markup)
  const unitPrice = sellingMatAndMarkupHw + hwAtCost
  const lineTotal = unitPrice * li.quantity
  const profitPerUnit = unitPrice - costPerUnit
  const marginPct = unitPrice > 0 ? (profitPerUnit / unitPrice) * 100 : 0
  return { ...li, cost_per_unit: costPerUnit, unit_price: unitPrice, line_total: lineTotal, profit_per_unit: profitPerUnit, margin_percentage: marginPct }
}

function hasPending(li: MfgQuoteLineItemDraft) {
  return li.materials.some(m => m.supplier_quoted && (m.unit_cost === null || m.unit_cost === undefined))
    || li.hardware.some(h => h.supplier_quoted && (h.unit_cost === null || h.unit_cost === undefined))
}

const BLANK_LINE = (markup: number): MfgQuoteLineItemDraft => ({
  sort_order: 0, description: '', callout_note: '', quantity: 1,
  unit_price: 0, line_total: 0, markup_percentage: markup,
  cost_per_unit: 0, profit_per_unit: 0, margin_percentage: 0,
  materials: [], hardware: [], cost_builder_open: true,
})

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceBookSelect({ items, itemType, onSelect, placeholder }: {
  items: MfgPriceBookItem[]
  itemType: 'material' | 'hardware'
  onSelect: (item: MfgPriceBookItem) => void
  placeholder: string
}) {
  const [q, setQ] = useState('')
  const filtered = items.filter(i => i.item_type === itemType && (i.name.toLowerCase().includes(q.toLowerCase())))
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
                {item.supplier_quoted ? '⚠ per quote' : `R ${item.cost_price?.toFixed(2)}`} /{item.unit === 'custom' ? item.unit_custom : item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  quote: { id: string; quote_number: string; revision_number: number; status: string; job_id: string; apply_vat: boolean; vat_rate: number; valid_until: string | null; notes: string | null; total: number; subtotal: number; vat_amount: number; total_cost: number; total_profit: number; job?: { id: string; job_name: string; client?: { client_name: string } | null } | null }
  initialLineItems: MfgQuoteLineItemDraft[]
  priceBook: MfgPriceBookItem[]
  settings: MfgSettings | null
  templates: MfgLineItemTemplateFull[]
  revisions: { id: string; revision_number: number; status: string; created_at: string }[]
}

export function MfgQuoteBuilder({ quote, initialLineItems, priceBook, settings, templates, revisions }: Props) {
  const router = useRouter()
  const defaultMarkup = settings?.default_markup_percentage ?? 30

  const [lineItems, setLineItems] = useState<MfgQuoteLineItemDraft[]>(
    initialLineItems.length ? initialLineItems.map(li => ({ ...li, cost_builder_open: false })) : []
  )
  const [showInternalView, setShowInternalView] = useState(false)
  const [applyVat, setApplyVat]   = useState(quote.apply_vat)
  const [vatRate] = useState(quote.vat_rate)
  const [saving, setSaving]       = useState(false)
  const [sending, setSending]         = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState('')
  const [error, setError]             = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef    = useRef(true)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState(quote.job?.client ? '' : '')
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertType, setConvertType] = useState<'full' | 'deposit'>('deposit')
  const [converting, setConverting] = useState(false)

  // Totals
  const subtotal = lineItems.reduce((s, li) => s + li.line_total, 0)
  const vatAmt   = applyVat ? subtotal * (vatRate / 100) : 0
  const total    = subtotal + vatAmt
  const totalCost   = lineItems.reduce((s, li) => s + li.cost_per_unit * li.quantity, 0)
  const totalProfit = subtotal - totalCost
  const totalMargin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0
  const hasPendingItems = lineItems.some(hasPending)

  // Autosave — 1.5s debounce after any line item change, skip on first render
  useEffect(() => {
    if (isReadOnly) return
    if (isMountRef.current) { isMountRef.current = false; return }
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { void handleSave(true) }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, applyVat])

  function updateLineItem(idx: number, updates: Partial<MfgQuoteLineItemDraft>) {
    setLineItems(prev => {
      const next = [...prev]
      const updated = calcLineItem({ ...next[idx], ...updates })
      next[idx] = updated
      return next
    })
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { ...BLANK_LINE(defaultMarkup), sort_order: prev.length }])
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function loadTemplate(idx: number, template: MfgLineItemTemplateFull) {
    const materials: MfgCostMaterialDraft[] = template.materials.map(m => {
      const pbItem = priceBook.find(p => p.id === m.price_book_item_id)
      return {
        price_book_item_id: m.price_book_item_id,
        item_name: m.item_name,
        unit: m.unit,
        quantity: m.quantity,
        unit_cost: pbItem?.supplier_quoted ? null : (pbItem?.cost_price ?? null),
        supplier_quoted: pbItem?.supplier_quoted ?? false,
        sort_order: m.sort_order,
      }
    })
    const hardware: MfgCostHardwareDraft[] = template.hardware.map(h => {
      const pbItem = priceBook.find(p => p.id === h.price_book_item_id)
      return {
        price_book_item_id: h.price_book_item_id,
        item_name: h.item_name,
        unit: h.unit,
        quantity: h.quantity,
        unit_cost: pbItem?.supplier_quoted ? null : (pbItem?.cost_price ?? null),
        supplier_quoted: pbItem?.supplier_quoted ?? false,
        apply_markup: h.apply_markup,
        sort_order: h.sort_order,
      }
    })
    updateLineItem(idx, {
      description: template.description ?? '',
      callout_note: template.callout_note ?? '',
      markup_percentage: template.default_markup_percentage,
      materials,
      hardware,
    })
  }

  function addMaterial(liIdx: number, item: MfgPriceBookItem) {
    const mat: MfgCostMaterialDraft = {
      price_book_item_id: item.id,
      item_name: item.name,
      unit: item.unit === 'custom' ? (item.unit_custom ?? item.unit) : item.unit,
      quantity: 1,
      unit_cost: item.supplier_quoted ? null : (item.cost_price ?? null),
      supplier_quoted: item.supplier_quoted,
      sort_order: lineItems[liIdx].materials.length,
    }
    updateLineItem(liIdx, { materials: [...lineItems[liIdx].materials, mat] })
  }

  function addHardware(liIdx: number, item: MfgPriceBookItem) {
    const hw: MfgCostHardwareDraft = {
      price_book_item_id: item.id,
      item_name: item.name,
      unit: item.unit === 'custom' ? (item.unit_custom ?? item.unit) : item.unit,
      quantity: 1,
      unit_cost: item.supplier_quoted ? null : (item.cost_price ?? null),
      supplier_quoted: item.supplier_quoted,
      apply_markup: item.apply_markup_default,
      sort_order: lineItems[liIdx].hardware.length,
    }
    updateLineItem(liIdx, { hardware: [...lineItems[liIdx].hardware, hw] })
  }

  const handleSave = useCallback(async (quiet = false) => {
    if (!quiet) setSaving(true)
    setError('')
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/line-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_items: lineItems }),
    })
    if (!quiet) setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Save failed'); return false }
    if (!quiet) { setSaveFeedback('Saved'); setTimeout(() => setSaveFeedback(''), 2000) }
    return true
  }, [quote.id, lineItems])

  async function handleSend() {
    if (!sendEmail.trim()) return
    setSending(true)
    await handleSave(true)
    const res = await fetch(`/api/supplier-portal/manufacturing/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sendEmail.trim() }),
    })
    setSending(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Send failed'); return }
    setShowSendModal(false)
    router.refresh()
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_type: convertType, deposit_percentage: settings?.default_deposit_percentage ?? 50 }),
    })
    setConverting(false)
    if (!res.ok) return
    setShowConvertModal(false)
    router.push('/supplier-portal/manufacturing/invoices')
  }

  const isReadOnly = quote.status === 'invoiced'

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
              style={{ background: quote.status === 'accepted' ? '#DCFCE7' : quote.status === 'sent' ? '#FEF3C7' : '#F4F4F5',
                       color: quote.status === 'accepted' ? '#16A34A' : quote.status === 'sent' ? '#D97706' : S.muted }}>
              {quote.status}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>
            {quote.job?.client?.client_name && <span className="font-medium">{quote.job.client.client_name} · </span>}
            {quote.job?.job_name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Revisions */}
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

          <button onClick={() => setShowInternalView(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: showInternalView ? '#EFF6FF' : S.input, color: showInternalView ? S.accent : S.muted, border: `1px solid ${S.border}` }}>
            {showInternalView ? <EyeOff size={12} /> : <Eye size={12} />}
            {showInternalView ? 'Hide margins' : 'Show margins'}
          </button>

          {!isReadOnly && (
            <>
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.muted }}>
                {saving
                  ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                  : saveFeedback
                  ? <><Check size={12} style={{ color: '#16A34A' }} /><span style={{ color: '#16A34A' }}>Saved</span></>
                  : <><Save size={12} /> Auto-saves</>
                }
              </div>

              {(quote.status === 'draft' || quote.status === 'sent') && (
                <button onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: S.accent }}>
                  <Send size={12} /> Send Quote
                </button>
              )}

              {(quote.status === 'sent' || quote.status === 'accepted') && (
                <button onClick={handleRevision} disabled={creatingRevision}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                  <RefreshCw size={12} /> New Revision
                </button>
              )}

              {quote.status === 'accepted' && (
                <button onClick={() => setShowConvertModal(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: '#16A34A' }}>
                  <Check size={12} /> Convert to Invoice
                </button>
              )}
            </>
          )}

          <a href={`/api/supplier-portal/manufacturing/quotes/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
            <FileDown size={12} /> PDF
          </a>
        </div>
      </div>

      {error && <p className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}
      {hasPendingItems && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
          <AlertTriangle size={14} /> Some line items have pending supplier quotes. Fill in prices before sending.
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-4 mb-6">
        {lineItems.map((li, liIdx) => {
          const pending = hasPending(li)
          return (
            <div key={liIdx} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${pending ? '#FDE68A' : S.border}`, background: S.card }}>

              {/* Line item header */}
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
                      rows={2}
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none transition-colors"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
                      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = '#fff' }}
                      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.input }}
                    />
                    <input
                      value={li.callout_note ?? ''}
                      onChange={e => updateLineItem(liIdx, { callout_note: e.target.value })}
                      placeholder="⚠ Callout note (printed in red on PDF — e.g. Client to confirm dimensions)"
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 text-xs rounded-lg outline-none transition-colors"
                      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: '#DC2626' }}
                    />
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: S.muted }}>Qty</label>
                        <input type="number" min={1} value={li.quantity}
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
                      {showInternalView && (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                            Margin: {li.margin_percentage.toFixed(1)}% · Profit: {fmt(li.profit_per_unit * li.quantity)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                    {templates.length > 0 && !isReadOnly && (
                      <div className="relative group">
                        <button className="p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1"
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
                    <button onClick={() => updateLineItem(liIdx, { cost_builder_open: !li.cost_builder_open })}
                      className="p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
                      style={{ color: S.accent, background: '#EFF6FF' }}>
                      {li.cost_builder_open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {li.cost_builder_open ? 'Collapse' : 'Cost Build'}
                    </button>
                    {!isReadOnly && (
                      <button onClick={() => removeLineItem(liIdx)} className="p-1.5 rounded-lg transition-colors"
                        style={{ color: S.muted }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                        onMouseLeave={e => (e.currentTarget.style.color = S.muted)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost Builder */}
              {li.cost_builder_open && (
                <div className="border-t px-5 pb-5 pt-4 space-y-5" style={{ borderColor: S.border, background: '#FAFBFC' }}>

                  {/* Markup */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.muted }}>Markup</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={li.markup_percentage}
                        onChange={e => updateLineItem(liIdx, { markup_percentage: parseFloat(e.target.value) || 0 })}
                        disabled={isReadOnly}
                        className="w-20 px-2 py-1 text-sm rounded-lg outline-none text-center"
                        style={{ background: li.markup_percentage !== defaultMarkup ? '#FEF3C7' : S.input, border: `1.5px solid ${li.markup_percentage !== defaultMarkup ? '#FDE68A' : S.border}`, color: S.text }} />
                      <span className="text-sm" style={{ color: S.muted }}>%</span>
                      {li.markup_percentage !== defaultMarkup && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>custom</span>
                      )}
                    </div>
                    <span className="text-xs ml-auto" style={{ color: S.muted }}>
                      Building cost for 1 unit × {li.quantity} unit{li.quantity !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Materials */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Materials</p>
                    {li.materials.length > 0 && (
                      <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${S.border}` }}>
                        {li.materials.map((m, mIdx) => (
                          <div key={mIdx} className="flex items-center gap-2 px-3 py-2 text-xs"
                            style={{ background: m.supplier_quoted ? '#FFFBEB' : S.card, borderTop: mIdx > 0 ? `1px solid ${S.border}` : undefined }}>
                            <span className="flex-1 truncate font-medium" style={{ color: S.text }}>{m.item_name}</span>
                            <input type="number" min={0.01} step={0.01} value={m.quantity}
                              onChange={e => {
                                const mats = [...li.materials]
                                mats[mIdx] = { ...mats[mIdx], quantity: parseFloat(e.target.value) || 1 }
                                updateLineItem(liIdx, { materials: mats })
                              }}
                              disabled={isReadOnly}
                              className="w-16 px-2 py-0.5 rounded text-center outline-none"
                              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                            <span style={{ color: S.muted }}>{m.unit}</span>
                            {m.supplier_quoted ? (
                              <input type="number" value={m.unit_cost ?? ''} placeholder="Enter quote"
                                onChange={e => {
                                  const mats = [...li.materials]
                                  mats[mIdx] = { ...mats[mIdx], unit_cost: e.target.value === '' ? null : parseFloat(e.target.value) }
                                  updateLineItem(liIdx, { materials: mats })
                                }}
                                disabled={isReadOnly}
                                className="w-28 px-2 py-0.5 rounded outline-none text-right"
                                style={{ background: '#FEF3C7', border: `1px solid #FDE68A`, color: '#92400E' }} />
                            ) : (
                              <span className="w-20 text-right font-semibold" style={{ color: S.text }}>
                                {m.unit_cost !== null && m.unit_cost !== undefined ? `R ${(m.unit_cost * m.quantity).toFixed(2)}` : '—'}
                              </span>
                            )}
                            {!isReadOnly && (
                              <button onClick={() => updateLineItem(liIdx, { materials: li.materials.filter((_, i) => i !== mIdx) })}
                                style={{ color: S.muted }}><Trash2 size={11} /></button>
                            )}
                          </div>
                        ))}
                        {/* Materials subtotal + markup */}
                        <div className="px-3 py-2 border-t space-y-1" style={{ borderColor: S.border, background: '#F8FAFC' }}>
                          <div className="flex justify-between text-xs">
                            <span style={{ color: S.muted }}>Materials subtotal</span>
                            <span style={{ color: S.text }}>R {li.materials.reduce((s,m) => s + (!m.unit_cost ? 0 : m.unit_cost * m.quantity), 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span style={{ color: S.muted }}>Markup {li.markup_percentage}%</span>
                            <span style={{ color: S.text }}>
                              R {(li.materials.reduce((s,m) => s + (!m.unit_cost ? 0 : m.unit_cost * m.quantity), 0) * li.markup_percentage / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {!isReadOnly && <PriceBookSelect items={priceBook} itemType="material" onSelect={item => addMaterial(liIdx, item)} placeholder="+ Add material from price book…" />}
                  </div>

                  {/* Hardware */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: S.muted }}>Hardware & Finishes</p>
                    {li.hardware.length > 0 && (
                      <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${S.border}` }}>
                        {li.hardware.map((h, hIdx) => (
                          <div key={hIdx} className="flex items-center gap-2 px-3 py-2 text-xs"
                            style={{ background: h.supplier_quoted ? '#FFFBEB' : S.card, borderTop: hIdx > 0 ? `1px solid ${S.border}` : undefined }}>
                            <span className="flex-1 truncate font-medium" style={{ color: S.text }}>{h.item_name}</span>
                            <input type="number" min={0.01} step={0.01} value={h.quantity}
                              onChange={e => {
                                const hws = [...li.hardware]
                                hws[hIdx] = { ...hws[hIdx], quantity: parseFloat(e.target.value) || 1 }
                                updateLineItem(liIdx, { hardware: hws })
                              }}
                              disabled={isReadOnly}
                              className="w-16 px-2 py-0.5 rounded text-center outline-none"
                              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                            <span style={{ color: S.muted }}>{h.unit}</span>
                            {/* Markup toggle */}
                            <button onClick={() => {
                                const hws = [...li.hardware]
                                hws[hIdx] = { ...hws[hIdx], apply_markup: !hws[hIdx].apply_markup }
                                updateLineItem(liIdx, { hardware: hws })
                              }}
                              disabled={isReadOnly}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
                              style={{ background: h.apply_markup ? '#EFF6FF' : S.input, color: h.apply_markup ? S.accent : S.muted }}>
                              {h.apply_markup ? 'markup ✓' : 'at cost'}
                            </button>
                            {h.supplier_quoted ? (
                              <input type="number" value={h.unit_cost ?? ''} placeholder="Enter quote"
                                onChange={e => {
                                  const hws = [...li.hardware]
                                  hws[hIdx] = { ...hws[hIdx], unit_cost: e.target.value === '' ? null : parseFloat(e.target.value) }
                                  updateLineItem(liIdx, { hardware: hws })
                                }}
                                disabled={isReadOnly}
                                className="w-28 px-2 py-0.5 rounded outline-none text-right"
                                style={{ background: '#FEF3C7', border: `1px solid #FDE68A`, color: '#92400E' }} />
                            ) : (
                              <span className="w-20 text-right font-semibold" style={{ color: S.text }}>
                                {h.unit_cost !== null && h.unit_cost !== undefined ? `R ${(h.unit_cost * h.quantity).toFixed(2)}` : '—'}
                              </span>
                            )}
                            {!isReadOnly && (
                              <button onClick={() => updateLineItem(liIdx, { hardware: li.hardware.filter((_, i) => i !== hIdx) })}
                                style={{ color: S.muted }}><Trash2 size={11} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!isReadOnly && <PriceBookSelect items={priceBook} itemType="hardware" onSelect={item => addHardware(liIdx, item)} placeholder="+ Add hardware from price book…" />}
                  </div>

                  {/* Cost summary */}
                  {(li.materials.length > 0 || li.hardware.length > 0) && (
                    <div className="rounded-xl p-4 space-y-1.5" style={{ background: '#EFF6FF', border: `1px solid rgba(27,79,138,0.15)` }}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: S.muted }}>Total cost per unit</span>
                        <span style={{ color: S.text }}>R {li.cost_per_unit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: S.muted }}>Selling price per unit</span>
                        <span style={{ color: S.text }}>{pending ? '—' : fmt(li.unit_price)}</span>
                      </div>
                      {showInternalView && (
                        <>
                          <div className="my-1 border-t" style={{ borderColor: 'rgba(27,79,138,0.15)' }} />
                          <div className="flex justify-between text-xs font-semibold">
                            <span style={{ color: S.accent }}>Profit per unit</span>
                            <span style={{ color: '#16A34A' }}>{fmt(li.profit_per_unit)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold">
                            <span style={{ color: S.accent }}>Margin</span>
                            <span style={{ color: '#16A34A' }}>{li.margin_percentage.toFixed(1)}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add line item */}
      {!isReadOnly && (
        <button onClick={addLineItem}
          className="w-full py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors mb-8"
          style={{ background: S.card, border: `1.5px dashed ${S.border}`, color: S.muted }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.color = S.accent }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.color = S.muted }}>
          <Plus size={15} /> Add Line Item
        </button>
      )}

      {/* Totals */}
      <div className="rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="space-y-2 max-w-sm ml-auto">
          {showInternalView && (
            <>
              <div className="flex justify-between text-xs pb-2" style={{ borderBottom: `1px dashed ${S.border}` }}>
                <span style={{ color: S.muted }}>Total cost</span>
                <span style={{ color: S.text }}>R {totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs pb-2" style={{ borderBottom: `1px solid ${S.border}` }}>
                <span style={{ color: '#16A34A' }}>Total profit ({totalMargin.toFixed(1)}%)</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>R {totalProfit.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span style={{ color: S.muted }}>Subtotal</span>
            <span style={{ color: S.text }}>R {subtotal.toFixed(2)}</span>
          </div>
          {applyVat && (
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>VAT ({vatRate}%)</span>
              <span style={{ color: S.text }}>R {vatAmt.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: `2px solid ${S.border}` }}>
            <span style={{ color: S.text }}>Total</span>
            <span style={{ color: S.text }}>R {total.toFixed(2)}</span>
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

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }}>
            <h3 className="text-base font-bold mb-4" style={{ color: S.text }}>Send Quote</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Send to</label>
                <input value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                  placeholder="client@email.com" type="email"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                  style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSend} disabled={sending || !sendEmail.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                <Send size={14} /> {sending ? 'Sending…' : 'Send'}
              </button>
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ color: S.muted }}>Cancel</button>
            </div>
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
                <label key={t} className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors"
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
