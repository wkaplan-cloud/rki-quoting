'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Save, Plus, Trash2, ChevronDown, ChevronRight,
  AlertCircle, Check, GripVertical, FolderPlus, Loader2, X, Download, Send, Link, FileText,
} from 'lucide-react'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecItemType, ElecQuoteStatus, ElecVariationOrder, ElecSnagItem, ElecCOC, ElecClaim, ElecClaimLineItem } from '@/lib/elec-types'
import { AsBuiltTab } from './AsBuiltTab'
import { VariationsTab } from './VariationsTab'
import { SnagTab } from './SnagTab'
import { COCTab } from './COCTab'
import { ClaimsTab } from './ClaimsTab'
import { ClientCombobox } from '../../ClientCombobox'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const STATUS_CONFIG: Record<ElecQuoteStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',       color: '#71717A', bg: '#F4F4F5' },
  quoted:      { label: 'Quoted',      color: '#3A7CA5', bg: 'rgba(58,124,165,0.1)' },
  approved:    { label: 'Approved',    color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
  in_progress: { label: 'In Progress', color: '#D9A441', bg: 'rgba(217,164,65,0.1)' },
  completed:   { label: 'Completed',   color: '#166534', bg: 'rgba(22,101,52,0.1)' },
  cancelled:   { label: 'Cancelled',   color: '#DC2626', bg: '#FEF2F2' },
}

const UNITS = ['nr', 'm', 'm²', 'm³', 'kg', 'l', 'hr', 'lot', 'allow', 'item']
const ITEM_TYPES: { value: ElecItemType; label: string }[] = [
  { value: 'both',        label: 'Labour & Material' },
  { value: 'labour',      label: 'Labour only' },
  { value: 'material',    label: 'Material only' },
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'subcontract', label: 'Subcontract' },
]

type ItemState  = Omit<ElecQuoteLineItem, 'created_at'> & { _expanded?: boolean }
type SectionState = Omit<ElecQuoteSection, 'created_at' | 'line_items'> & { items: ItemState[] }

function newItem(quoteId: string, sectionId: string | null, sortOrder: number): ItemState {
  return {
    id: crypto.randomUUID(), quote_id: quoteId, section_id: sectionId,
    description: '', unit: 'nr', item_type: 'both', drawing_reference: null,
    subcontractor_name: null, quoted_quantity: 1, quoted_unit_rate: 0,
    labour_rate: null, material_rate: null, cost_unit_rate: null, markup_percentage: null,
    as_built_quantity: null, as_built_unit_rate: null, variation_order_id: null, is_variation: false,
    sort_order: sortOrder, _expanded: false,
  }
}

function newSection(quoteId: string, sortOrder: number): SectionState {
  return { id: crypto.randomUUID(), quote_id: quoteId, title: '', sort_order: sortOrder, items: [] }
}

function itemTotal(item: ItemState) { return (item.quoted_quantity ?? 0) * (item.quoted_unit_rate ?? 0) }

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Description autocomplete ─────────────────────────────────────────────────
interface Suggestion { description: string; unit: string | null; item_type: string; default_unit_rate: number | null; default_labour_rate: number | null; default_material_rate: number | null }

function DescriptionInput({ value, onChange, onSelect, portalAccountId, locked }: {
  value: string; onChange: (v: string) => void
  onSelect: (s: Suggestion) => void; portalAccountId: string; locked?: boolean
}) {
  const supabase = createClient()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.length < 2 || locked) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('elec_item_library')
        .select('description, unit, item_type, default_unit_rate, default_labour_rate, default_material_rate')
        .eq('portal_account_id', portalAccountId)
        .ilike('description', `${value}%`)
        .order('usage_count', { ascending: false })
        .limit(8)
      const results = (data ?? []) as Suggestion[]
      setSuggestions(results)
      if (focused) setOpen(results.length > 0)
    }, 200)
    return () => clearTimeout(t)
  }, [value, portalAccountId, locked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative flex-1">
      <input value={value} onChange={e => onChange(e.target.value)} disabled={locked}
        placeholder="Description"
        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
        style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, minWidth: 180 }}
        onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true) }}
        onBlur={() => setFocused(false)}
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-20 rounded-xl overflow-hidden mt-1"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {suggestions.map(s => (
            <button key={s.description}
              onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: S.text }}>{s.description}</span>
              {s.default_unit_rate != null && (
                <span className="text-xs ml-2 flex-shrink-0" style={{ color: S.muted }}>
                  {fmtR(s.default_unit_rate)}{s.unit ? `/${s.unit}` : ''}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Line item row ────────────────────────────────────────────────────────────
function LineItemRow({ item, onChange, onDelete, portalAccountId, locked }: {
  item: ItemState; onChange: (u: ItemState) => void
  onDelete: () => void; portalAccountId: string; locked?: boolean
}) {
  const exp = item._expanded ?? false
  function set(patch: Partial<ItemState>) { onChange({ ...item, ...patch }) }

  const numInput = (val: number | null, cb: (n: number) => void, placeholder = '0', w = 90) => (
    <input type="number" value={val ?? ''} onChange={e => cb(parseFloat(e.target.value) || 0)}
      disabled={locked} placeholder={placeholder}
      className="px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
      style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, width: w }} />
  )

  return (
    <div className="rounded-xl mb-1.5" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
      <div className="flex items-center gap-2 p-2">
        <GripVertical size={14} style={{ color: S.border, flexShrink: 0 }} />
        <DescriptionInput value={item.description} onChange={v => set({ description: v })}
          onSelect={s => set({ description: s.description, unit: s.unit ?? item.unit, item_type: (s.item_type as ElecItemType) ?? item.item_type, quoted_unit_rate: s.default_unit_rate ?? item.quoted_unit_rate, labour_rate: s.default_labour_rate ?? item.labour_rate, material_rate: s.default_material_rate ?? item.material_rate })}
          portalAccountId={portalAccountId} locked={locked} />
        <select value={item.unit ?? 'nr'} onChange={e => set({ unit: e.target.value })} disabled={locked}
          className="px-2 py-1.5 text-sm rounded-lg outline-none"
          style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, width: 72 }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {numInput(item.quoted_quantity, v => set({ quoted_quantity: v }), 'Qty')}
        {numInput(item.quoted_unit_rate, v => {
          const patch: Partial<ItemState> = { quoted_unit_rate: v }
          if (item.cost_unit_rate != null && item.cost_unit_rate > 0) {
            patch.markup_percentage = Math.round(((v - item.cost_unit_rate) / item.cost_unit_rate) * 1000) / 10
          }
          set(patch)
        }, 'Rate')}
        <div className="text-sm font-semibold text-right flex-shrink-0" style={{ color: S.text, width: 100 }}>
          {fmtR(itemTotal(item))}
        </div>
        <button onClick={() => set({ _expanded: !exp })} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.background = S.border}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {exp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {!locked && (
          <button onClick={onDelete} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {exp && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3" style={{ borderTop: `1px solid ${S.border}` }}>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Item Type</label>
            <select value={item.item_type} onChange={e => set({ item_type: e.target.value as ElecItemType })} disabled={locked}
              className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
              style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }}>
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Drawing Ref</label>
            <input value={item.drawing_reference ?? ''} onChange={e => set({ drawing_reference: e.target.value || null })}
              disabled={locked} placeholder="e.g. E-03 Rev 2"
              className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
              style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
          </div>
          {item.item_type === 'subcontract' && (
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Subcontractor</label>
              <input value={item.subcontractor_name ?? ''} onChange={e => set({ subcontractor_name: e.target.value || null })}
                disabled={locked} placeholder="Company name"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
                style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          )}
          {/* Costing — internal only */}
          <div className="col-span-2 pt-3 mt-1" style={{ borderTop: `1px dashed ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: S.muted }}>Cost &amp; Margin (internal)</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Cost Rate</label>
                <input type="number" value={item.cost_unit_rate ?? ''}
                  onChange={e => {
                    const cost = e.target.value === '' ? null : parseFloat(e.target.value)
                    const patch: Partial<ItemState> = { cost_unit_rate: cost }
                    if (cost != null && cost > 0 && item.markup_percentage != null) {
                      patch.quoted_unit_rate = Math.round(cost * (1 + item.markup_percentage / 100) * 100) / 100
                    }
                    set(patch)
                  }}
                  disabled={locked} placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
                  style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Markup %</label>
                <input type="number" value={item.markup_percentage ?? ''}
                  onChange={e => {
                    const markup = e.target.value === '' ? null : parseFloat(e.target.value)
                    const patch: Partial<ItemState> = { markup_percentage: markup }
                    if (markup != null && item.cost_unit_rate != null && item.cost_unit_rate > 0) {
                      patch.quoted_unit_rate = Math.round(item.cost_unit_rate * (1 + markup / 100) * 100) / 100
                    }
                    set(patch)
                  }}
                  disabled={locked} placeholder="0"
                  className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
                  style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
              </div>
              {item.cost_unit_rate != null && (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Profit / Unit</label>
                    <div className="px-2.5 py-1.5 text-sm rounded-lg text-right font-medium"
                      style={{ background: S.bg, border: `1px solid ${S.border}`, color: ((item.quoted_unit_rate ?? 0) - item.cost_unit_rate) >= 0 ? S.green : S.danger }}>
                      {fmtR((item.quoted_unit_rate ?? 0) - item.cost_unit_rate)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Margin %</label>
                    <div className="px-2.5 py-1.5 text-sm rounded-lg text-right font-medium"
                      style={{ background: S.bg, border: `1px solid ${S.border}`, color: (item.quoted_unit_rate ?? 0) > 0 ? (((item.quoted_unit_rate ?? 0) - item.cost_unit_rate) >= 0 ? S.green : S.danger) : S.muted }}>
                      {(item.quoted_unit_rate ?? 0) > 0
                        ? `${Math.round(((item.quoted_unit_rate - item.cost_unit_rate) / item.quoted_unit_rate) * 1000) / 10}%`
                        : '—'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────
function SectionBlock({ section, onChange, onDelete, onAddItem, onDeleteItem, portalAccountId, locked }: {
  section: SectionState; onChange: (s: SectionState) => void
  onDelete: () => void; onAddItem: () => void
  onDeleteItem: (id: string) => void; portalAccountId: string; locked?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const subtotal = section.items.reduce((s, i) => s + itemTotal(i), 0)
  const sectionCostTotal = section.items.reduce((s, i) => i.cost_unit_rate != null ? s + (i.quoted_quantity ?? 0) * i.cost_unit_rate : s, 0)
  const hasCosting = section.items.some(i => i.cost_unit_rate != null)
  const sectionMarginPct = hasCosting && subtotal > 0 ? ((subtotal - sectionCostTotal) / subtotal * 100) : null
  const colHdr = (label: string, w: number, align: 'left' | 'right' | 'center' = 'left') => (
    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, width: w, textAlign: align, flexShrink: 0 }}>{label}</div>
  )

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ border: `1px solid ${S.border}`, background: S.card }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(58,124,165,0.04)', borderBottom: collapsed ? 'none' : `1px solid ${S.border}` }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ color: S.muted, flexShrink: 0 }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <input value={section.title} onChange={e => onChange({ ...section, title: e.target.value })}
          disabled={locked} placeholder="Section title (e.g. DB Board)"
          className="flex-1 bg-transparent text-sm font-semibold outline-none" style={{ color: S.text }} />
        <span className="text-sm font-semibold flex-shrink-0" style={{ color: S.accent }}>{fmtR(subtotal)}</span>
        {sectionMarginPct !== null && (
          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
            style={{ background: sectionMarginPct >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: sectionMarginPct >= 0 ? S.green : S.danger }}>
            {Math.round(sectionMarginPct * 10) / 10}% margin
          </span>
        )}
        <span className="text-xs flex-shrink-0" style={{ color: S.muted }}>{section.items.length} item{section.items.length !== 1 ? 's' : ''}</span>
        {!locked && (
          <button onClick={onDelete} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="p-3">
          {section.items.length > 0 && (
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <div style={{ width: 14 }} />
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 180 }}>Description</div>
              {colHdr('Unit', 72, 'center')}
              {colHdr('Qty', 90, 'right')}
              {colHdr('Rate', 90, 'right')}
              {colHdr('Total', 100, 'right')}
              <div style={{ width: 52 }} />
            </div>
          )}
          {section.items.map(item => (
            <LineItemRow key={item.id} item={item}
              onChange={u => onChange({ ...section, items: section.items.map(i => i.id === u.id ? u : i) })}
              onDelete={() => onDeleteItem(item.id)}
              portalAccountId={portalAccountId} locked={locked} />
          ))}
          {!locked && (
            <button onClick={onAddItem}
              className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: S.accent }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Plus size={12} /> Add item
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────
interface Props {
  portalAccountId: string
  quote: ElecQuote & { client: ElecClient | null }
  sections: ElecQuoteSection[]
  items: ElecQuoteLineItem[]
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'qs_name' | 'qs_email'>[]
  variations: ElecVariationOrder[]
  snags: ElecSnagItem[]
  coc: ElecCOC | null
  claims: (ElecClaim & { line_items: ElecClaimLineItem[] })[]
  voPrefix: string
  cocPrefix: string
  companyCode: string
  sageConnected?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type QuoteTab = 'quote' | 'as_built' | 'claims' | 'variations' | 'snag' | 'coc'

export function QuoteEditor({ portalAccountId, quote: initialQuote, sections: initSections, items: initItems, clients: initialClients, variations, snags, coc, claims, voPrefix, cocPrefix, companyCode, sageConnected = false }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [q, setQ] = useState(initialQuote)
  const [clientDisplay, setClientDisplay] = useState(initialQuote.client?.client_name ?? '')
  const [clients, setClients] = useState(initialClients)
  const [voCreatedClaims, setVOCreatedClaims] = useState<(ElecClaim & { line_items: ElecClaimLineItem[] })[]>([])
  const [liveVOs, setLiveVOs] = useState(variations)

  const [sections, setSections] = useState<SectionState[]>(() =>
    initSections.map(s => ({ ...s, items: initItems.filter(i => i.section_id === s.id).map(i => ({ ...i, _expanded: false })) }))
  )
  const [freeItems, setFreeItems] = useState<ItemState[]>(() =>
    initItems.filter(i => i.section_id === null).map(i => ({ ...i, _expanded: false }))
  )

  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([])
  const [deletedItemIds, setDeletedItemIds]       = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError]   = useState('')
  const [activeTab, setActiveTab]   = useState<QuoteTab>('quote')

  const locked = ['approved', 'in_progress', 'completed', 'cancelled'].includes(q.status)
  const showTabs = ['in_progress', 'completed'].includes(q.status)

  const [showSendModal, setShowSendModal] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendMethod, setSendMethod] = useState<'link' | 'pdf'>('link')
  const [sendMessage, setSendMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  function openSendModal() {
    setSendEmail(q.client?.email ?? '')
    setSendMethod('link')
    setSendMessage('')
    setSendStatus('idle')
    setShowSendModal(true)
  }

  async function handleSendToClient() {
    if (!sendEmail.trim() || sendStatus === 'sending') return
    setSendStatus('sending')
    const endpoint = sendMethod === 'link'
      ? `/api/supplier-portal/quoting/quotes/${q.id}/send-link`
      : `/api/supplier-portal/quoting/quotes/${q.id}/send-pdf`
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail.trim(), message: sendMessage.trim() || undefined }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        setSendStatus('sent')
        // Update local status to quoted if it was draft
        if (q.status === 'draft') {
          setQ(p => ({ ...p, status: 'quoted', quoted_date: new Date().toISOString().split('T')[0] }))
        }
        setTimeout(() => setShowSendModal(false), 1800)
      } else {
        setSendStatus('error')
        setSaveError(json.error ?? 'Failed to send')
      }
    } catch {
      setSendStatus('error')
    }
  }
  const allItems = [...freeItems, ...sections.flatMap(s => s.items)]
  const subtotal  = allItems.reduce((s, i) => s + itemTotal(i), 0)
  const vatAmt    = subtotal * ((q.vat_rate ?? 15) / 100)
  const total     = subtotal + vatAmt
  const retention = subtotal * ((q.retention_percentage ?? 0) / 100)

  // ── Save function (stable ref so auto-save always calls latest) ─────────────
  const saveDataRef = useRef({ q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems })
  useEffect(() => { saveDataRef.current = { q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems } }, [q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems])

  const handleSave = useCallback(async () => {
    const { q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems } = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      await supabase.from('elec_quotes').update({
        project_name: q.project_name, project_address: q.project_address,
        client_id: q.client_id, project_type: q.project_type,
        vat_rate: q.vat_rate, retention_percentage: q.retention_percentage,
        payment_terms_days: q.payment_terms_days, liquidated_damages_per_day: q.liquidated_damages_per_day,
        defects_liability_period_days: q.defects_liability_period_days,
        notes: q.notes, quoted_date: q.quoted_date, expected_completion_date: q.expected_completion_date,
      }).eq('id', q.id)

      if (deletedSectionIds.length > 0) await supabase.from('elec_quote_sections').delete().in('id', deletedSectionIds)
      if (deletedItemIds.length > 0)    await supabase.from('elec_quote_line_items').delete().in('id', deletedItemIds)

      for (let si = 0; si < sections.length; si++) {
        const s = sections[si]
        await supabase.from('elec_quote_sections').upsert({ id: s.id, quote_id: q.id, title: s.title, sort_order: si })
        for (let ii = 0; ii < s.items.length; ii++) {
          const item = s.items[ii]
          await supabase.from('elec_quote_line_items').upsert({
            id: item.id, quote_id: q.id, section_id: s.id, description: item.description,
            unit: item.unit, item_type: item.item_type, drawing_reference: item.drawing_reference,
            subcontractor_name: item.subcontractor_name, quoted_quantity: item.quoted_quantity,
            quoted_unit_rate: item.quoted_unit_rate, labour_rate: item.labour_rate,
            material_rate: item.material_rate, cost_unit_rate: item.cost_unit_rate,
            markup_percentage: item.markup_percentage, is_variation: item.is_variation, sort_order: ii,
          })
        }
      }
      for (let ii = 0; ii < freeItems.length; ii++) {
        const item = freeItems[ii]
        await supabase.from('elec_quote_line_items').upsert({
          id: item.id, quote_id: q.id, section_id: null, description: item.description,
          unit: item.unit, item_type: item.item_type, drawing_reference: item.drawing_reference,
          subcontractor_name: item.subcontractor_name, quoted_quantity: item.quoted_quantity,
          quoted_unit_rate: item.quoted_unit_rate, labour_rate: item.labour_rate,
          material_rate: item.material_rate, cost_unit_rate: item.cost_unit_rate,
          markup_percentage: item.markup_percentage, is_variation: item.is_variation, sort_order: ii,
        })
      }

      // Sync item library in background
      for (const item of allItems) {
        if (!item.description.trim()) continue
        supabase.rpc('upsert_elec_item_library', {
          p_portal_account_id: portalAccountId, p_description: item.description.trim(),
          p_unit: item.unit, p_item_type: item.item_type,
          p_default_unit_rate: item.quoted_unit_rate,
          p_default_labour_rate: item.labour_rate, p_default_material_rate: item.material_rate,
        })
      }

      setDeletedSectionIds([]); setDeletedItemIds([])
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
      setSaveStatus('error')
    }
  }, [portalAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save: 1.5s debounce after any data change ──────────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isMountRef = useRef(true)

  useEffect(() => {
    if (isMountRef.current) { isMountRef.current = false; return }
    if (locked) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => void handleSave(), 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [q, sections, freeItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Status transitions ───────────────────────────────────────────────────────
  async function transition(newStatus: ElecQuoteStatus, extra?: Partial<typeof q>) {
    const update = { status: newStatus, ...extra }
    await supabase.from('elec_quotes').update(update).eq('id', q.id)
    setQ(prev => ({ ...prev, ...update }))
  }

  async function archiveQuote() {
    if (!confirm('Archive this draft? It will be hidden from your quotes list. You can contact support to recover it within 60 days.')) return
    await supabase.from('elec_quotes').update({ archived_at: new Date().toISOString() }).eq('id', q.id)
    router.push('/supplier-portal/quoting/quotes')
  }

  function addSection() { setSections(ss => [...ss, newSection(q.id, ss.length)]) }
  function addFreeItem() { setFreeItems(items => [...items, newItem(q.id, null, items.length)]) }

  function deleteSection(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    if (section) setDeletedItemIds(ids => [...ids, ...section.items.map(i => i.id)])
    setDeletedSectionIds(ids => [...ids, sectionId])
    setSections(ss => ss.filter(s => s.id !== sectionId))
  }
  function deleteSectionItem(sectionId: string, itemId: string) {
    setDeletedItemIds(ids => [...ids, itemId])
    setSections(ss => ss.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s))
  }
  function deleteFreeItem(itemId: string) {
    setDeletedItemIds(ids => [...ids, itemId])
    setFreeItems(items => items.filter(i => i.id !== itemId))
  }

  const st = STATUS_CONFIG[q.status]

  const TABS: { id: QuoteTab; label: string }[] = [
    { id: 'quote',      label: 'Quote' },
    { id: 'variations', label: 'Variations' },
    { id: 'claims',     label: 'Claims' },
    { id: 'snag',       label: 'Snag List' },
    { id: 'coc',        label: 'COC' },
    { id: 'as_built',   label: 'As-Built' },
  ]

  const contractTotal = allItems.reduce((s, i) => s + (i.quoted_quantity ?? 0) * (i.quoted_unit_rate ?? 0), 0)
  const approvedVOs = liveVOs.filter(v => v.status === 'approved')
  const approvedVOTotal = approvedVOs.reduce((s, v) => s + v.value, 0)
  const approvedVOCostTotal = approvedVOs.reduce((s, v) => s + (v.cost_value ?? 0), 0)
  const itemCostTotal = allItems.reduce((s, i) => i.cost_unit_rate != null ? s + (i.quoted_quantity ?? 0) * i.cost_unit_rate : s, 0)
  const costTotal = itemCostTotal + approvedVOCostTotal
  const grossProfit = subtotal - itemCostTotal
  const hasCostData = allItems.some(i => i.cost_unit_rate != null) || approvedVOs.some(v => v.cost_value != null)
  const revisedTotal = contractTotal + approvedVOTotal
  const revisedGrossProfit = revisedTotal - costTotal

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/supplier-portal/quoting/quotes')}
          className="flex items-center gap-1.5 text-sm font-medium" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.color = S.text}
          onMouseLeave={e => e.currentTarget.style.color = S.muted}>
          <ChevronLeft size={16} /> Quotes
        </button>
        <div className="flex-1" />
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: S.muted }}>
          {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin" />Saving…</>}
          {saveStatus === 'saved'  && <><Check size={12} style={{ color: S.green }} /><span style={{ color: S.green }}>Saved</span></>}
          {saveStatus === 'error'  && <><AlertCircle size={12} style={{ color: S.danger }} /><span style={{ color: S.danger }}>{saveError}</span></>}
        </div>
        {/* Manual save fallback */}
        {!locked && (
          <button onClick={() => void handleSave()} disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
            <Save size={12} /> Save
          </button>
        )}
        <a href={`/api/supplier-portal/quoting/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}>
          <Download size={12} /> PDF
        </a>
        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: S.bg, color: S.muted }}>{q.quote_number}</span>
        {q.status === 'in_progress' ? (
          <button
            onClick={() => { if (confirm('Mark this project as completed?')) transition('completed') }}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-75"
            style={{ background: st.bg, color: st.color }}>
            {st.label} <span style={{ fontSize: 10 }}>▾</span>
          </button>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
        )}
      </div>

      {/* Tab nav (only in_progress / completed) */}
      {showTabs && (
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: S.bg }}>
          {TABS.flatMap(tab => {
            const btn = (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: activeTab === tab.id ? S.card : 'transparent',
                  color:      activeTab === tab.id ? S.text : S.muted,
                  boxShadow:  activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {tab.label}
              </button>
            )
            if (tab.id === 'claims' || tab.id === 'snag') {
              return [
                <div key={`div-${tab.id}`} style={{ width: 1, height: 20, background: S.muted, flexShrink: 0, margin: '0 4px', opacity: 0.35 }} />,
                btn,
              ]
            }
            return [btn]
          })}
        </div>
      )}

      {/* Project profit strip — always visible when in progress / completed */}
      {showTabs && (() => {
        const metrics = [
          { label: 'Contract', value: fmtR(contractTotal), color: S.text },
          ...(approvedVOTotal !== 0 ? [{ label: 'Approved VOs', value: `+${fmtR(approvedVOTotal)}`, color: S.green }] : []),
          { label: approvedVOTotal !== 0 ? 'Revised Total' : 'Contract Total', value: fmtR(revisedTotal), color: S.accent },
          ...(hasCostData ? [
            { label: 'Cost', value: fmtR(costTotal), color: S.text },
            { label: 'Gross Profit', value: fmtR(revisedGrossProfit), color: revisedGrossProfit >= 0 ? S.green : S.danger },
            { label: 'Margin', value: revisedTotal > 0 ? `${Math.round(revisedGrossProfit / revisedTotal * 1000) / 10}%` : '—', color: revisedGrossProfit >= 0 ? S.green : S.danger },
          ] : []),
        ]
        return (
          <div className="flex items-stretch rounded-2xl px-5 py-3.5 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {metrics.map((m, i) => (
              <div key={m.label} className="flex items-stretch">
                {i > 0 && <div style={{ width: 1, background: S.border, margin: '0 20px', alignSelf: 'stretch' }} />}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>{m.label}</p>
                  <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Non-quote tabs — always mounted to preserve state; hidden when inactive */}
      {showTabs && (
        <>
          <div style={{ display: activeTab === 'as_built' ? undefined : 'none' }}>
            <AsBuiltTab
              quoteId={q.id}
              sections={sections as unknown as ElecQuoteSection[]}
              items={allItems as ElecQuoteLineItem[]}
              contractTotal={contractTotal}
              clientEmail={q.client?.email ?? null}
            />
          </div>
          <div style={{ display: activeTab === 'claims' ? undefined : 'none' }}>
            <ClaimsTab
              quoteId={q.id}
              portalAccountId={portalAccountId}
              initialClaims={claims}
              extraClaims={voCreatedClaims}
              items={allItems as ElecQuoteLineItem[]}
              sections={sections as unknown as ElecQuoteSection[]}
              contractTotal={contractTotal}
              approvedVOTotal={approvedVOTotal}
              contractType={q.contract_type}
              retentionPct={q.retention_percentage}
              client={clients.find(c => c.id === q.client_id) ?? null}
              sageConnected={sageConnected}
            />
          </div>
          <div style={{ display: activeTab === 'variations' ? undefined : 'none' }}>
            <VariationsTab
              quoteId={q.id}
              portalAccountId={portalAccountId}
              initialVOs={variations}
              initialClaims={claims}
              voPrefix={voPrefix}
              companyCode={companyCode}
              sections={sections as unknown as ElecQuoteSection[]}
              items={allItems as ElecQuoteLineItem[]}
              client={clients.find(c => c.id === q.client_id) ?? null}
              onClaimCreated={c => setVOCreatedClaims(prev => [c, ...prev])}
              onVOsChanged={setLiveVOs}
            />
          </div>
          <div style={{ display: activeTab === 'snag' ? undefined : 'none' }}>
            <SnagTab quoteId={q.id} initialSnags={snags} />
          </div>
          <div style={{ display: activeTab === 'coc' ? undefined : 'none' }}>
            <COCTab quoteId={q.id} initialCOC={coc} cocPrefix={cocPrefix} companyCode={companyCode}
              projectAddress={q.project_address ?? null}
              clientName={q.client?.client_name ?? null}
              clientEmail={q.client?.email ?? null} />
          </div>
        </>
      )}

      {/* Quote tab content */}
      <div style={{ display: !showTabs || activeTab === 'quote' ? undefined : 'none' }}>

      {/* Project name */}
      <input value={q.project_name} onChange={e => setQ(p => ({ ...p, project_name: e.target.value }))}
        disabled={locked} placeholder="Project Name"
        className="w-full text-2xl font-bold bg-transparent outline-none mb-4"
        style={{ color: S.text, border: 'none' }} />

      {/* Header card — condensed summary when locked, form when editable */}
      {locked ? (
        <div className="rounded-2xl p-5 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {/* Client block */}
          {q.client && (
            <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <p className="text-sm font-semibold" style={{ color: S.text }}>{q.client.client_name}</p>
              {q.client.company && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client.company}</p>}
              {(q.client.email || q.client.contact_number) && (
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  {[q.client.email, q.client.contact_number].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          )}
          {/* Project & contract details */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            {q.project_address && (
              <div className="col-span-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Address</p>
                <p className="text-sm" style={{ color: S.text }}>{q.project_address}</p>
              </div>
            )}
            {[
              { label: 'Project Type',    value: q.project_type ? q.project_type.charAt(0).toUpperCase() + q.project_type.slice(1) : null },
              { label: 'Quote Date',      value: q.quoted_date ?? null },
              { label: 'Est. Completion', value: q.expected_completion_date ?? null },
              { label: 'Retention',       value: q.retention_percentage > 0 ? `${q.retention_percentage}%` : null },
              { label: 'Payment Terms',   value: q.payment_terms_days ? `${q.payment_terms_days} days` : null },
              { label: 'Defects Liability', value: q.defects_liability_period_days ? `${q.defects_liability_period_days} days` : null },
              { label: 'Created',         value: new Date(q.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + (q.created_by_name ? ` by ${q.created_by_name}` : '') },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>{f.label}</p>
                <p className="text-sm" style={{ color: S.text }}>{f.value}</p>
              </div>
            ))}
          </div>
          {q.notes && (
            <p className="text-sm mt-4 pt-4 italic" style={{ color: S.muted, borderTop: `1px solid ${S.border}` }}>{q.notes}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-4 grid grid-cols-2 gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {/* Client — combobox */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Client</label>
            <ClientCombobox
              clientId={q.client_id}
              displayName={clientDisplay}
              clients={clients}
              portalAccountId={portalAccountId}
              disabled={false}
              onChange={(id, name) => {
                setQ(p => ({ ...p, client_id: id }))
                setClientDisplay(name)
                if (id && !clients.find(c => c.id === id)) {
                  setClients(cs => [...cs, { id, client_name: name, company: null, email: null, qs_name: null, qs_email: null }].sort((a, b) => a.client_name.localeCompare(b.client_name)))
                }
              }}
            />
          </div>

          {/* Project address */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project Address</label>
            <input value={q.project_address ?? ''} onChange={e => setQ(p => ({ ...p, project_address: e.target.value || null }))}
              placeholder="Site address"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* Project type */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project Type</label>
            <select value={q.project_type ?? ''} onChange={e => setQ(p => ({ ...p, project_type: (e.target.value || null) as ElecQuote['project_type'] }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: q.project_type ? S.text : S.muted }}>
              <option value="">Select type</option>
              {['residential','commercial','industrial','retail'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Quote Date</label>
            <input type="date" value={q.quoted_date ?? ''} onChange={e => setQ(p => ({ ...p, quoted_date: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Expected Completion</label>
            <input type="date" value={q.expected_completion_date ?? ''} onChange={e => setQ(p => ({ ...p, expected_completion_date: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Retention (%)</label>
            <input type="number" value={q.retention_percentage ?? 0} onChange={e => setQ(p => ({ ...p, retention_percentage: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          <div className="col-span-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
            <textarea value={q.notes ?? ''} onChange={e => setQ(p => ({ ...p, notes: e.target.value || null }))}
              rows={2} placeholder="Any notes for this quote…"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Line Items</h2>
          {!locked && (
            <div className="flex items-center gap-2">
              <button onClick={addFreeItem} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
                <Plus size={12} /> Add item
              </button>
              <button onClick={addSection} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
                <FolderPlus size={12} /> Add section
              </button>
            </div>
          )}
        </div>

        {freeItems.length > 0 && (
          <div className="rounded-2xl p-3 mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <div style={{ width: 14 }} />
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 180 }}>Description</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, width: 72, textAlign: 'center' }}>Unit</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, width: 90, textAlign: 'right' }}>Qty</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, width: 90, textAlign: 'right' }}>Rate</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, width: 100, textAlign: 'right' }}>Total</div>
              <div style={{ width: 52 }} />
            </div>
            {freeItems.map(item => (
              <LineItemRow key={item.id} item={item}
                onChange={u => setFreeItems(items => items.map(i => i.id === u.id ? u : i))}
                onDelete={() => deleteFreeItem(item.id)}
                portalAccountId={portalAccountId} locked={locked} />
            ))}
          </div>
        )}

        {sections.map(section => (
          <SectionBlock key={section.id} section={section}
            onChange={u => setSections(ss => ss.map(s => s.id === u.id ? u : s))}
            onDelete={() => deleteSection(section.id)}
            onAddItem={() => setSections(ss => ss.map(s => s.id === section.id
              ? { ...s, items: [...s.items, newItem(q.id, s.id, s.items.length)] } : s))}
            onDeleteItem={itemId => deleteSectionItem(section.id, itemId)}
            portalAccountId={portalAccountId} locked={locked} />
        ))}

        {allItems.length === 0 && !locked && (
          <div className="rounded-2xl py-10 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-sm mb-3" style={{ color: S.muted }}>No line items yet</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={addFreeItem} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                <Plus size={13} /> Add item
              </button>
              <button onClick={addSection} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'rgba(58,124,165,0.1)', color: S.accent }}>
                <FolderPlus size={13} /> Add section
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="space-y-2 max-w-sm ml-auto">
          {hasCostData && (
            <>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Revenue (ex VAT)</span>
                <span className="font-medium" style={{ color: S.text }}>{fmtR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Cost (ex VAT)</span>
                <span className="font-medium" style={{ color: S.text }}>{fmtR(costTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Gross Profit</span>
                <span className="font-medium" style={{ color: grossProfit >= 0 ? S.green : S.danger }}>{fmtR(grossProfit)}</span>
              </div>
              <div className="flex justify-between text-sm pb-2" style={{ borderBottom: `1px solid ${S.border}` }}>
                <span style={{ color: S.muted }}>Margin</span>
                <span className="font-semibold" style={{ color: grossProfit >= 0 ? S.green : S.danger }}>
                  {subtotal > 0 ? `${Math.round(grossProfit / subtotal * 1000) / 10}%` : '—'}
                </span>
              </div>
            </>
          )}
          {!hasCostData && (
            <div className="flex justify-between text-sm">
              <span style={{ color: S.muted }}>Subtotal (ex VAT)</span>
              <span className="font-medium" style={{ color: S.text }}>{fmtR(subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span style={{ color: S.muted }}>VAT ({q.vat_rate ?? 15}%)</span>
            <span className="font-medium" style={{ color: S.text }}>{fmtR(vatAmt)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: `1px solid ${S.border}` }}>
            <span style={{ color: S.text }}>Total incl. VAT</span>
            <span style={{ color: S.accent }}>{fmtR(total)}</span>
          </div>
          {(q.retention_percentage ?? 0) > 0 && (
            <div className="flex justify-between text-sm pt-1">
              <span style={{ color: S.muted }}>Retention ({q.retention_percentage}%)</span>
              <span className="font-medium" style={{ color: S.gold }}>{fmtR(retention)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status actions */}
      <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <span className="text-sm font-medium flex-1" style={{ color: S.muted }}>Status</span>
        {q.status === 'draft' && (
          <>
            <button onClick={() => void archiveQuote()}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#FEF2F2', color: S.danger }}>
              Archive
            </button>
            <button onClick={() => void handleSave()} disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
              <Save size={13} /> Save Draft
            </button>
            <button onClick={openSendModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: S.accent }}>
              <Send size={13} /> Send to Client →
            </button>
          </>
        )}
        {q.status === 'quoted' && <>
          <button onClick={() => transition('draft')}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: S.bg, color: S.muted }}>
            ← Back to Draft
          </button>
          <button onClick={openSendModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(58,124,165,0.1)', color: S.accent, border: `1px solid rgba(58,124,165,0.25)` }}>
            <Send size={13} /> Send Again
          </button>
          <button onClick={() => transition('approved', { approved_date: new Date().toISOString().split('T')[0] })}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: S.green }}>
            Mark Approved →
          </button>
        </>}
        {q.status === 'approved' && (
          <button onClick={() => transition('in_progress')}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: S.gold }}>
            Start Project →
          </button>
        )}
        {q.status === 'in_progress' && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm flex-1" style={{ color: S.muted }}>
              Project in progress — use the Claims tab to invoice
            </span>
            <button
              onClick={() => { if (confirm('Cancel this project? This cannot be undone.')) transition('cancelled') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{ background: '#FEF2F2', color: S.danger }}>
              Cancel Project
            </button>
            <button
              onClick={() => { if (confirm('Mark this project as completed?')) transition('completed') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{ background: 'rgba(22,101,52,0.1)', color: '#166534', border: '1px solid rgba(22,101,52,0.2)' }}>
              Mark Complete ✓
            </button>
          </div>
        )}
        {(q.status === 'quoted' || q.status === 'approved') && (
          <button onClick={() => { if (confirm('Cancel this quote?')) transition('cancelled') }}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#FEF2F2', color: S.danger }}>
            Cancel
          </button>
        )}
      </div>

      </div>{/* end quote tab */}

      {/* ── Send to Client Modal ──────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSendModal(false) }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-base" style={{ color: S.text }}>Send to Client</h2>
              <button onClick={() => setShowSendModal(false)} className="p-1.5 rounded-lg" style={{ color: S.muted }}
                onMouseEnter={e => e.currentTarget.style.background = S.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={16} />
              </button>
            </div>

            {sendStatus === 'sent' ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'rgba(22,163,74,0.1)' }}>
                  <Check size={22} style={{ color: S.green }} />
                </div>
                <p className="font-semibold" style={{ color: S.green }}>Email sent!</p>
                <p className="text-sm mt-1" style={{ color: S.muted }}>{sendEmail}</p>
              </div>
            ) : (
              <>
                {/* Email */}
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>
                    Client Email
                  </label>
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={e => setSendEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  />
                </div>

                {/* Send method */}
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: S.muted }}>
                    How to send
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSendMethod('link')}
                      className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left transition-all"
                      style={{
                        background: sendMethod === 'link' ? 'rgba(58,124,165,0.08)' : S.bg,
                        border: `1.5px solid ${sendMethod === 'link' ? S.accent : S.border}`,
                      }}>
                      <div className="flex items-center gap-1.5">
                        <Link size={13} style={{ color: sendMethod === 'link' ? S.accent : S.muted }} />
                        <span className="text-xs font-semibold" style={{ color: sendMethod === 'link' ? S.accent : S.text }}>
                          Approval Link
                        </span>
                      </div>
                      <span className="text-[11px] leading-snug" style={{ color: S.muted }}>
                        Client approves online with one click
                      </span>
                    </button>
                    <button
                      onClick={() => setSendMethod('pdf')}
                      className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl text-left transition-all"
                      style={{
                        background: sendMethod === 'pdf' ? 'rgba(58,124,165,0.08)' : S.bg,
                        border: `1.5px solid ${sendMethod === 'pdf' ? S.accent : S.border}`,
                      }}>
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} style={{ color: sendMethod === 'pdf' ? S.accent : S.muted }} />
                        <span className="text-xs font-semibold" style={{ color: sendMethod === 'pdf' ? S.accent : S.text }}>
                          PDF Attachment
                        </span>
                      </div>
                      <span className="text-[11px] leading-snug" style={{ color: S.muted }}>
                        Quote PDF attached to the email
                      </span>
                    </button>
                  </div>
                </div>

                {/* Optional message */}
                <div className="mb-5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>
                    Message <span style={{ color: S.muted, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    value={sendMessage}
                    onChange={e => setSendMessage(e.target.value)}
                    rows={2}
                    placeholder="Add a personal note to the email…"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}
                  />
                </div>

                {sendStatus === 'error' && (
                  <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: S.danger }}>
                    <AlertCircle size={12} /> {saveError || 'Failed to send — please try again'}
                  </p>
                )}

                <button
                  onClick={() => void handleSendToClient()}
                  disabled={!sendEmail.trim() || sendStatus === 'sending'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: S.accent, color: '#fff' }}>
                  {sendStatus === 'sending' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sendStatus === 'sending' ? 'Sending…' : `Send ${sendMethod === 'link' ? 'Approval Link' : 'PDF'}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
