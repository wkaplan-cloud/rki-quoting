'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Save, Plus, Trash2, ChevronDown, ChevronRight,
  AlertCircle, Check, GripVertical, FolderPlus, Loader2, X, Download, Send, Link, FileText,
  MoreHorizontal, Archive, Lock, Printer,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecItemType, ElecQuoteStatus, ElecVariationOrder, ElecSnagItem, ElecCOC, ElecClaim, ElecClaimLineItem, ElecStaff } from '@/lib/elec-types'
import { AsBuiltTab } from './AsBuiltTab'
import { VariationsTab } from './VariationsTab'
import { SnagTab } from './SnagTab'
import { COCTab } from './COCTab'
import { ReportingTab } from './ReportingTab'
import { ClaimsTab } from './ClaimsTab'
import { MaterialsTab } from './MaterialsTab'
import { ClientCombobox } from '../../ClientCombobox'
import { StaffMultiSelect } from '../../StaffMultiSelect'

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

const LIFECYCLE_STEPS: { status: ElecQuoteStatus; label: string }[] = [
  { status: 'draft',       label: 'Draft' },
  { status: 'quoted',      label: 'Quoted' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed',   label: 'Completed' },
]

const CONTRACT_TYPES = [
  { value: 'lump_sum',       label: 'Lump Sum' },
  { value: 're_measurement', label: 'Re-measurement' },
  { value: 'cost_plus',      label: 'Cost Plus' },
]

const UNITS = ['nr', 'm']

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

function computeSellRate(item: ItemState): number {
  if (item.cost_unit_rate != null) {
    return item.cost_unit_rate * (1 + (item.markup_percentage ?? 0) / 100)
  }
  return item.quoted_unit_rate ?? 0
}
function itemTotal(item: ItemState): number {
  return (item.quoted_quantity ?? 0) * computeSellRate(item) + (item.labour_rate ?? 0)
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Description autocomplete ─────────────────────────────────────────────────
interface Suggestion { description: string; unit: string | null; item_type: string; default_unit_rate: number | null; default_cost_rate: number | null; default_labour_rate: number | null; default_material_rate: number | null; category: string | null; default_markup_percent: number | null }

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
        .select('description, unit, item_type, default_unit_rate, default_cost_rate, default_labour_rate, default_material_rate, category, default_markup_percent')
        .eq('portal_account_id', portalAccountId)
        .ilike('description', `%${value}%`)
        .order('usage_count', { ascending: false })
        .limit(10)
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

  // Group suggestions by category for display
  const grouped: { category: string | null; items: Suggestion[] }[] = []
  for (const s of suggestions) {
    const last = grouped[grouped.length - 1]
    if (last && last.category === s.category) { last.items.push(s) }
    else { grouped.push({ category: s.category, items: [s] }) }
  }

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
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 280 }}>
          {grouped.map(group => (
            <div key={group.category ?? '__none__'}>
              {group.category && (
                <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: S.muted }}>
                  {group.category}
                </div>
              )}
              {group.items.map(s => (
                <button key={s.description}
                  onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors"
                  onMouseEnter={e => e.currentTarget.style.background = S.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ color: S.text }}>{s.description}</span>
                  {(s.default_markup_percent != null || s.unit) && (
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: S.muted }}>
                      {s.unit ?? ''}{s.default_markup_percent != null ? ` · ${s.default_markup_percent}%` : ''}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Line item row ────────────────────────────────────────────────────────────
function LineItemRow({ item, onChange, onDelete, portalAccountId, locked, dragHandleProps }: {
  item: ItemState; onChange: (u: ItemState) => void
  onDelete: () => void; portalAccountId: string; locked?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}) {
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
        <div {...(dragHandleProps ?? {})} style={{ flexShrink: 0, display: 'flex', cursor: locked ? 'default' : 'grab' }}>
          <GripVertical size={14} style={{ color: S.border }} />
        </div>
        <DescriptionInput value={item.description} onChange={v => set({ description: v })}
          onSelect={s => {
            set({
              description: s.description,
              unit: s.unit ?? item.unit,
              markup_percentage: s.default_markup_percent ?? item.markup_percentage,
            })
          }}
          portalAccountId={portalAccountId} locked={locked} />
        <select value={item.unit ?? 'nr'} onChange={e => set({ unit: e.target.value })} disabled={locked}
          className="px-2 py-1.5 text-sm rounded-lg outline-none"
          style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, width: 60 }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {numInput(item.quoted_quantity, v => {
          set({ quoted_quantity: v })
        }, 'Qty', 72)}
        {numInput(item.cost_unit_rate, v => {
          const sell = v * (1 + (item.markup_percentage ?? 0) / 100)
          set({ cost_unit_rate: v, quoted_unit_rate: Math.round(sell * 100) / 100 })
        }, 'Cost', 82)}
        {numInput(item.markup_percentage, v => {
          const sell = (item.cost_unit_rate ?? 0) * (1 + v / 100)
          set({ markup_percentage: v, quoted_unit_rate: Math.round(sell * 100) / 100 })
        }, '%', 65)}
        {/* Sell rate per unit — read only */}
        <div className="text-sm text-right flex-shrink-0" style={{ color: S.muted, width: 72 }}>
          {fmtR(computeSellRate(item))}
        </div>
        {/* Material subtotal = qty × sell rate */}
        <div className="text-sm text-right flex-shrink-0" style={{ color: S.muted, width: 82 }}>
          {fmtR((item.quoted_quantity ?? 0) * computeSellRate(item))}
        </div>
        {numInput(item.labour_rate, v => {
          set({ labour_rate: v })
        }, 'Labour', 82)}
        <div className="text-sm font-semibold text-right flex-shrink-0" style={{ color: S.text, width: 92 }}>
          {fmtR(itemTotal(item))}
        </div>
        {!locked && (
          <button onClick={onDelete} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────
function SectionBlock({ section, onChange, onDelete, onAddItem, onDeleteItem, portalAccountId, locked, dragHandleProps }: {
  section: SectionState; onChange: (s: SectionState) => void
  onDelete: () => void; onAddItem: () => void
  onDeleteItem: (id: string) => void; portalAccountId: string; locked?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
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
        <div {...(dragHandleProps ?? {})} style={{ flexShrink: 0, display: 'flex', cursor: locked ? 'default' : 'grab' }}>
          <GripVertical size={14} style={{ color: S.border }} />
        </div>
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
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 160 }}>Description</div>
              {colHdr('Unit', 60, 'center')}
              {colHdr('Qty', 72, 'right')}
              {colHdr('Cost', 82, 'right')}
              {colHdr('Mkup', 65, 'right')}
              {colHdr('Rate', 72, 'right')}
              {colHdr('Subtotal', 82, 'right')}
              {colHdr('+Labour', 82, 'right')}
              {colHdr('Total', 92, 'right')}
              <div style={{ width: 28 }} />
            </div>
          )}
          <Droppable droppableId={section.id} type="ITEM">
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                {section.items.map((item, idx) => (
                  <Draggable key={item.id} draggableId={item.id} index={idx} isDragDisabled={!!locked}>
                    {(dragProvided) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                        <LineItemRow item={item}
                          onChange={u => onChange({ ...section, items: section.items.map(i => i.id === u.id ? u : i) })}
                          onDelete={() => onDeleteItem(item.id)}
                          portalAccountId={portalAccountId} locked={locked}
                          dragHandleProps={dragProvided.dragHandleProps} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
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
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company' | 'email' | 'address' | 'qs_name' | 'qs_email'>[]
  staff?: Pick<ElecStaff, 'id' | 'name' | 'color' | 'role'>[]
  variations: ElecVariationOrder[]
  snags?: ElecSnagItem[]
  coc: ElecCOC | null
  claims: (ElecClaim & { line_items: ElecClaimLineItem[] })[]
  voPrefix: string
  cocPrefix: string
  companyCode: string
  sageConnected?: boolean
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type QuoteTab = 'quote' | 'as_built' | 'claims' | 'variations' | 'materials' | 'snag' | 'coc' | 'reporting'

export function QuoteEditor({ portalAccountId, quote: initialQuote, sections: initSections, items: initItems, clients: initialClients, staff = [], variations, snags, coc, claims, voPrefix, cocPrefix, companyCode, sageConnected = false }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [q, setQ] = useState(initialQuote)
  const [clientDisplay, setClientDisplay] = useState(initialQuote.client?.client_name ?? '')
  const [clientCompany, setClientCompany] = useState(initialQuote.client?.company ?? '')
  const [clientQsName, setClientQsName] = useState(initialQuote.client?.qs_name ?? '')
  const [clientQsEmail, setClientQsEmail] = useState(initialQuote.client?.qs_email ?? '')
  const [clientVatNumber, setClientVatNumber] = useState(initialQuote.client?.vat_number ?? '')
  const [clients, setClients] = useState(initialClients)
  const [voCreatedClaims, setVOCreatedClaims] = useState<(ElecClaim & { line_items: ElecClaimLineItem[] })[]>([])
  const [liveVOs, setLiveVOs] = useState(variations)
  // VO items created/edited in this session (not in initItems) — needed so ClaimsTab sees them without reload
  const [sessionVOItems, setSessionVOItems] = useState<ElecQuoteLineItem[]>([])
  const [replacedVOIds, setReplacedVOIds] = useState<string[]>([])
  function handleVOItemsCreated(voId: string, items: ElecQuoteLineItem[]) {
    setSessionVOItems(prev => [...prev.filter(i => i.variation_order_id !== voId), ...items])
    setReplacedVOIds(prev => prev.includes(voId) ? prev : [...prev, voId])
  }

  const [sections, setSections] = useState<SectionState[]>(() =>
    initSections.map(s => ({ ...s, items: initItems.filter(i => i.section_id === s.id && !i.is_variation).map(i => ({ ...i, _expanded: false })) }))
  )
  const [freeItems, setFreeItems] = useState<ItemState[]>(() =>
    initItems.filter(i => i.section_id === null && !i.is_variation).map(i => ({ ...i, _expanded: false }))
  )

  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([])
  const [deletedItemIds, setDeletedItemIds]       = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError]   = useState('')
  const [activeTab, setActiveTab]   = useState<QuoteTab>('quote')
  const [transitioning, setTransitioning] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showReconModal, setShowReconModal] = useState(false)

  const locked = ['approved', 'in_progress', 'completed', 'cancelled'].includes(q.status)
  const showTabs = true
  const tabAccessible: Record<QuoteTab, boolean> = {
    quote:      true,
    variations: ['approved', 'in_progress', 'completed'].includes(q.status),
    claims:     ['in_progress', 'completed'].includes(q.status),
    materials:  ['in_progress', 'completed'].includes(q.status),
    snag:       ['in_progress', 'completed'].includes(q.status),
    coc:        ['in_progress', 'completed'].includes(q.status),
    as_built:   ['in_progress', 'completed'].includes(q.status),
    reporting:  ['in_progress', 'completed'].includes(q.status),
  }

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
        body: JSON.stringify({
          email: sendEmail.trim(),
          message: sendMessage.trim() || undefined,
          company: clientCompany.trim() || undefined,
          qs_name: clientQsName.trim() || undefined,
          qs_email: clientQsEmail.trim() || undefined,
        }),
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
  // Merge session VO items into what child tabs see, replacing any stale initItems copies
  const itemsForChildTabs = [
    ...initItems.filter(i => !(i.is_variation && i.variation_order_id && replacedVOIds.includes(i.variation_order_id))),
    ...sessionVOItems,
  ] as ElecQuoteLineItem[]
  const subtotal  = allItems.reduce((s, i) => s + itemTotal(i), 0)
  const vatAmt    = subtotal * ((q.vat_rate ?? 15) / 100)
  const total     = subtotal + vatAmt
  const retention = subtotal * ((q.retention_percentage ?? 0) / 100)

  // ── Save function (stable ref so auto-save always calls latest) ─────────────
  const saveDataRef = useRef({ q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems, clientCompany, clientQsName, clientQsEmail, clientVatNumber })
  useEffect(() => { saveDataRef.current = { q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems, clientCompany, clientQsName, clientQsEmail, clientVatNumber } }, [q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems, clientCompany, clientQsName, clientQsEmail, clientVatNumber])

  const handleSave = useCallback(async () => {
    const { q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems, clientCompany, clientQsName, clientQsEmail, clientVatNumber } = saveDataRef.current
    setSaveStatus('saving'); setSaveError('')
    try {
      await supabase.from('elec_quotes').update({
        project_name: q.project_name, project_address: q.project_address,
        client_id: q.client_id, project_type: q.project_type,
        contract_type: q.contract_type,
        staff_id: q.staff_id,
        additional_staff_ids: q.additional_staff_ids ?? [],
        vat_rate: q.vat_rate, retention_percentage: q.retention_percentage,
        payment_terms_days: q.payment_terms_days,
        defects_liability_period_days: q.defects_liability_period_days,
        drawing_reference: q.drawing_reference,
        notes: q.notes, quoted_date: q.quoted_date, expected_completion_date: q.expected_completion_date,
      }).eq('id', q.id)

      // Sync client fields via server route (supabaseAdmin bypasses RLS)
      if (q.client_id) {
        const patch: Record<string, string | null> = {}
        if (q.project_address?.trim()) patch.address = q.project_address.trim()
        if (clientCompany.trim()) patch.company = clientCompany.trim()
        if (clientQsName.trim()) patch.qs_name = clientQsName.trim()
        if (clientQsEmail.trim()) patch.qs_email = clientQsEmail.trim()
        patch.vat_number = clientVatNumber.trim() || null
        if (Object.keys(patch).length > 0) {
          fetch(`/api/supplier-portal/quoting/clients/${q.client_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
        }
      }

      await Promise.all([
        deletedSectionIds.length > 0 ? supabase.from('elec_quote_sections').delete().in('id', deletedSectionIds) : Promise.resolve(),
        deletedItemIds.length > 0    ? supabase.from('elec_quote_line_items').delete().in('id', deletedItemIds)   : Promise.resolve(),
      ])

      if (sections.length > 0) {
        await supabase.from('elec_quote_sections').upsert(
          sections.map((s, si) => ({ id: s.id, quote_id: q.id, title: s.title, sort_order: si }))
        )
      }

      const allItemRows = [
        ...sections.flatMap((s) => s.items.map((item, ii) => ({
          id: item.id, quote_id: q.id, section_id: s.id, description: item.description,
          unit: item.unit, item_type: item.item_type, drawing_reference: item.drawing_reference,
          subcontractor_name: item.subcontractor_name, quoted_quantity: item.quoted_quantity,
          quoted_unit_rate: item.quoted_unit_rate, labour_rate: item.labour_rate,
          material_rate: item.material_rate, cost_unit_rate: item.cost_unit_rate,
          markup_percentage: item.markup_percentage, is_variation: item.is_variation, sort_order: ii,
        }))),
        ...freeItems.map((item, ii) => ({
          id: item.id, quote_id: q.id, section_id: null, description: item.description,
          unit: item.unit, item_type: item.item_type, drawing_reference: item.drawing_reference,
          subcontractor_name: item.subcontractor_name, quoted_quantity: item.quoted_quantity,
          quoted_unit_rate: item.quoted_unit_rate, labour_rate: item.labour_rate,
          material_rate: item.material_rate, cost_unit_rate: item.cost_unit_rate,
          markup_percentage: item.markup_percentage, is_variation: item.is_variation, sort_order: ii,
        })),
      ]
      if (allItemRows.length > 0) {
        await supabase.from('elec_quote_line_items').upsert(allItemRows)
      }

      // Auto-add new items to library (description + unit + markup % only, fire-and-forget)
      const libraryItems = allItems
        .filter(i => i.description.trim())
        .map(i => ({ description: i.description.trim(), unit: i.unit, default_markup_percent: i.markup_percentage }))
      if (libraryItems.length > 0) {
        fetch('/api/supplier-portal/quoting/item-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: libraryItems }),
        }).catch(() => {})
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
  }, [q, sections, freeItems, clientCompany, clientQsName, clientQsEmail, clientVatNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset active tab to quote if it becomes inaccessible after status change
  useEffect(() => {
    if (!tabAccessible[activeTab]) setActiveTab('quote')
  }, [q.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Status transitions ───────────────────────────────────────────────────────
  async function transition(newStatus: ElecQuoteStatus, extra?: Partial<typeof q>) {
    setTransitioning(true)
    const update = { status: newStatus, ...extra }
    const { error } = await supabase.from('elec_quotes').update(update).eq('id', q.id)
    setTransitioning(false)
    if (error) { alert(error.message); return }
    setQ(prev => ({ ...prev, ...update }))
  }

  async function archiveQuote() {
    if (!confirm('Archive this draft? It will be hidden from your quotes list. You can contact support to recover it within 60 days.')) return
    const { error } = await supabase.from('elec_quotes').update({ archived_at: new Date().toISOString() }).eq('id', q.id)
    if (error) { alert(error.message); return }
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

  function onDragEnd(result: DropResult) {
    const { source, destination, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    if (type === 'SECTION') {
      setSections(ss => {
        const next = [...ss]
        const [removed] = next.splice(source.index, 1)
        next.splice(destination.index, 0, removed)
        return next
      })
    } else {
      const srcId = source.droppableId
      const dstId = destination.droppableId
      if (srcId === dstId) {
        if (srcId === 'free') {
          setFreeItems(items => {
            const next = [...items]
            const [removed] = next.splice(source.index, 1)
            next.splice(destination.index, 0, removed)
            return next
          })
        } else {
          setSections(ss => ss.map(s => {
            if (s.id !== srcId) return s
            const next = [...s.items]
            const [removed] = next.splice(source.index, 1)
            next.splice(destination.index, 0, removed)
            return { ...s, items: next }
          }))
        }
      } else {
        // Move item between sections (or free ↔ section)
        let srcItems: ItemState[]
        let dstItems: ItemState[]
        if (srcId === 'free') {
          srcItems = [...freeItems]
          dstItems = [...(sections.find(s => s.id === dstId)?.items ?? [])]
        } else if (dstId === 'free') {
          srcItems = [...(sections.find(s => s.id === srcId)?.items ?? [])]
          dstItems = [...freeItems]
        } else {
          srcItems = [...(sections.find(s => s.id === srcId)?.items ?? [])]
          dstItems = [...(sections.find(s => s.id === dstId)?.items ?? [])]
        }
        const [moved] = srcItems.splice(source.index, 1)
        const updatedItem = { ...moved, section_id: dstId === 'free' ? null : dstId }
        dstItems.splice(destination.index, 0, updatedItem)

        if (srcId === 'free') {
          setFreeItems(srcItems)
        } else {
          setSections(ss => ss.map(s => s.id === srcId ? { ...s, items: srcItems } : s))
        }
        if (dstId === 'free') {
          setFreeItems(dstItems)
        } else {
          setSections(ss => ss.map(s => s.id === dstId ? { ...s, items: dstItems } : s))
        }
      }
    }
  }

  const st = STATUS_CONFIG[q.status]

  const TABS: { id: QuoteTab; label: string }[] = [
    { id: 'quote',      label: 'Quote' },
    { id: 'variations', label: 'Variations' },
    { id: 'claims',     label: 'Claims' },
    { id: 'materials',  label: 'Materials' },
    { id: 'snag',       label: 'Snag List' },
    { id: 'as_built',   label: 'As-Built' },
  ]

  const contractTotal = allItems.reduce((s, i) => s + itemTotal(i), 0)
  const approvedVOs = liveVOs.filter(v => v.status === 'approved')
  const approvedVOTotal = approvedVOs.reduce((s, v) => s + v.value, 0)
  const approvedVOCostTotal = approvedVOs.reduce((s, v) => s + (v.cost_value ?? 0), 0)
  const itemCostTotal = allItems.reduce((s, i) => i.cost_unit_rate != null ? s + (i.quoted_quantity ?? 0) * i.cost_unit_rate : s, 0)
  const costTotal = itemCostTotal + approvedVOCostTotal
  const labourTotal = allItems.reduce((s, i) => s + (i.labour_rate ?? 0), 0)
  const materialProfit = subtotal - labourTotal - itemCostTotal
  const grossProfit = materialProfit + labourTotal  // material profit + labour (all labour is profit — no labour cost tracked)
  const hasCostData = allItems.some(i => i.cost_unit_rate != null) || approvedVOs.some(v => v.cost_value != null)
  const revisedTotal = contractTotal + approvedVOTotal
  const revisedGrossProfit = revisedTotal - costTotal

  return (
    <div className="pb-16">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <button onClick={() => router.push('/supplier-portal/quoting/quotes')}
          className="flex items-center gap-1.5 text-sm font-medium" style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.color = S.text}
          onMouseLeave={e => e.currentTarget.style.color = S.muted}>
          <ChevronLeft size={15} /> Projects
        </button>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs" style={{ color: S.muted }}>Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-xs" style={{ color: S.green }}>Saved</span>}
          {saveStatus === 'error'  && <span className="text-xs" style={{ color: S.danger }}>{saveError}</span>}
          {q.status === 'quoted' && (
            <button onClick={() => void transition('in_progress', { approved_date: new Date().toISOString().split('T')[0] })}
              disabled={transitioning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: S.green, color: '#fff' }}>
              <Check size={13} /> Mark Approved
            </button>
          )}
          {q.status === 'in_progress' && (
            <button disabled={transitioning}
              onClick={() => { if (confirm('Mark this project as completed?')) void transition('completed') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: S.green, color: '#fff' }}>
              <Check size={13} /> Mark Complete
            </button>
          )}
          {/* Overflow */}
          <div className="relative">
            <button onClick={() => setShowMoreMenu(m => !m)}
              className="flex items-center px-2.5 py-1.5 rounded-lg"
              style={{ border: `1px solid ${S.border}`, color: S.muted, background: S.card }}>
              <MoreHorizontal size={15} />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-lg py-1 min-w-[180px]"
                  style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <button onClick={() => { setShowMoreMenu(false); setShowReconModal(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                    style={{ color: S.text }}>
                    <FileText size={14} /> Recon / Sign-off Sheet
                  </button>
                  {['draft', 'quoted'].includes(q.status) && (
                    <button onClick={() => { setShowMoreMenu(false); void archiveQuote() }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                      style={{ color: S.danger }}>
                      <Archive size={14} /> Archive
                    </button>
                  )}
                  {['quoted', 'in_progress'].includes(q.status) && (
                    <button onClick={() => { setShowMoreMenu(false); if (confirm('Cancel this quote / project?')) void transition('cancelled') }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                      style={{ color: S.danger }}>
                      <X size={14} /> Cancel Project
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Project header ─────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono mb-1" style={{ color: S.muted }}>{q.quote_number}</p>
            <input value={q.project_name}
              onChange={e => setQ(p => ({ ...p, project_name: e.target.value }))}
              disabled={locked}
              placeholder="Project Name"
              className="w-full text-xl font-bold bg-transparent outline-none leading-snug"
              style={{ color: S.text, border: 'none' }} />
            <div className="flex items-center gap-3 mt-1.5 text-sm flex-wrap" style={{ color: S.muted }}>
              {q.client && !Array.isArray(q.client) && <span style={{ color: S.text, fontWeight: 500 }}>{q.client.client_name}</span>}
              {q.project_address && <span>{q.project_address}</span>}
            </div>
          </div>
          {/* Status badge */}
          <div className="shrink-0">
            {q.status === 'cancelled'
              ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#FEF2F2', color: S.danger }}>Cancelled</span>
              : (() => {
                  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
                    draft:       { label: 'Draft',       color: S.muted,   bg: S.bg            },
                    quoted:      { label: 'Quoted',      color: S.accent,  bg: 'rgba(58,124,165,0.08)' },
                    approved:    { label: 'Approved',    color: S.green,   bg: 'rgba(22,163,74,0.08)'  },
                    in_progress: { label: 'In Progress', color: '#166534', bg: 'rgba(22,101,52,0.08)'  },
                    completed:   { label: 'Completed',   color: '#166534', bg: 'rgba(22,101,52,0.08)'  },
                  }
                  const sc = statusCfg[q.status] ?? statusCfg.draft
                  return (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                  )
                })()
            }
          </div>
        </div>

        {/* Lifecycle stepper */}
        {q.status !== 'cancelled' && (
          <div className="flex items-center mt-4">
            {LIFECYCLE_STEPS.map((step, i) => {
              const currentIdx = LIFECYCLE_STEPS.findIndex(s => s.status === q.status)
              const isPast    = i < currentIdx
              const isCurrent = i === currentIdx
              return (
                <div key={step.status} className="flex items-center" style={{ flex: i < LIFECYCLE_STEPS.length - 1 ? 1 : undefined }}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {step.status === 'completed' && tabAccessible.coc && (
                      <button onClick={() => setActiveTab('coc')}
                        className="text-[9px] font-semibold px-2 py-0.5 rounded mb-0.5"
                        style={{
                          background: activeTab === 'coc' ? S.accent : 'rgba(58,124,165,0.08)',
                          color: activeTab === 'coc' ? '#fff' : S.accent,
                          border: `1px solid ${activeTab === 'coc' ? S.accent : 'rgba(58,124,165,0.2)'}`,
                        }}>
                        COC
                      </button>
                    )}
                    <div className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: isCurrent ? S.accent : isPast ? S.accent : 'transparent',
                        border: `2px solid ${isCurrent ? S.accent : isPast ? S.accent : S.border}`,
                      }}>
                      {isPast    && <Check size={8} color="#fff" strokeWidth={3} />}
                      {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <p className="text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: isCurrent ? S.accent : isPast ? S.accent : S.muted }}>
                      {step.label}
                    </p>
                  </div>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 mb-3" style={{ background: isPast ? S.accent : S.border }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Tabs — flat underline style ─────────────────────────────────────── */}
      <div className="flex gap-0 mb-5" style={{ borderBottom: `1px solid ${S.border}` }}>
        {TABS.map(tab => {
          const accessible = tabAccessible[tab.id]
          const isActive   = activeTab === tab.id
          return (
            <button key={tab.id}
              onClick={() => accessible && setActiveTab(tab.id)}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap relative"
              style={{
                color:  isActive ? S.text : accessible ? S.muted : S.border,
                cursor: accessible ? 'pointer' : 'default',
              }}>
              {tab.label}
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: S.accent }} />}
              {!accessible && <Lock size={9} className="inline ml-1" style={{ color: S.border }} />}
            </button>
          )
        })}
      </div>

      {/* Project profit strip — always visible when in progress / completed */}
      {showTabs && (() => {
        const stripProfit = revisedTotal - itemCostTotal  // gross profit incl. labour (labour cost = 0)
        const stripMaterialProfit = revisedTotal - labourTotal - itemCostTotal
        const vatRate = q.vat_rate ?? 0
        const revisedTotalInclVat = revisedTotal * (1 + vatRate / 100)
        const metrics = [
          ...(approvedVOTotal !== 0 ? [
            { label: 'Contract (ex VAT)', value: fmtR(contractTotal), color: S.text },
            { label: 'Approved VOs', value: `+${fmtR(approvedVOTotal)}`, color: S.green },
            { label: 'Revised (ex VAT)', value: fmtR(revisedTotal), color: S.accent },
          ] : [
            { label: 'Contract (ex VAT)', value: fmtR(revisedTotal), color: S.accent },
          ]),
          ...(hasCostData ? [
            { label: 'Cost', value: fmtR(itemCostTotal), color: S.text },
            { label: 'Material Profit', value: fmtR(stripMaterialProfit), color: stripMaterialProfit >= 0 ? S.green : S.danger },
            ...(labourTotal > 0 ? [{ label: '+ Labour', value: fmtR(labourTotal), color: S.green }] : []),
            { label: 'Gross Profit', value: fmtR(stripProfit), color: stripProfit >= 0 ? S.green : S.danger },
            { label: 'Margin', value: revisedTotal > 0 ? `${Math.round(stripProfit / revisedTotal * 1000) / 10}%` : '—', color: stripProfit >= 0 ? S.green : S.danger },
          ] : []),
          { label: `Total incl. VAT (${vatRate}%)`, value: fmtR(revisedTotalInclVat), color: S.accent },
        ]
        return (
          <div className="flex items-stretch rounded-2xl px-4 py-3 mb-4 overflow-x-auto" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {metrics.map((m, i) => (
              <div key={m.label} className="flex items-stretch">
                {i > 0 && <div style={{ width: 1, background: S.border, margin: '0 14px', alignSelf: 'stretch' }} />}
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>{m.label}</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Non-quote tabs — mounted only when tab is accessible; hidden when not active */}
      {tabAccessible.as_built && (
        <div style={{ display: activeTab === 'as_built' ? undefined : 'none' }}>
          <AsBuiltTab
            quoteId={q.id}
            sections={sections as unknown as ElecQuoteSection[]}
            items={itemsForChildTabs}
            contractTotal={contractTotal}
            approvedVOTotal={approvedVOTotal}
            clientEmail={q.client?.email ?? null}
          />
        </div>
      )}
      {tabAccessible.claims && (
        <div style={{ display: activeTab === 'claims' ? undefined : 'none' }}>
          <ClaimsTab
            quoteId={q.id}
            portalAccountId={portalAccountId}
            initialClaims={claims}
            extraClaims={voCreatedClaims}
            items={itemsForChildTabs}
            sections={sections as unknown as ElecQuoteSection[]}
            contractTotal={contractTotal}
            approvedVOTotal={approvedVOTotal}
            contractType={q.contract_type}
            retentionPct={q.retention_percentage}
            client={clients.find(c => c.id === q.client_id) ?? null}
            sageConnected={sageConnected}
          />
        </div>
      )}
      {tabAccessible.variations && (
        <div style={{ display: activeTab === 'variations' ? undefined : 'none' }}>
          <VariationsTab
            quoteId={q.id}
            portalAccountId={portalAccountId}
            initialVOs={variations}
            initialClaims={claims}
            voPrefix={voPrefix}
            companyCode={companyCode}
            sections={sections as unknown as ElecQuoteSection[]}
            items={itemsForChildTabs}
            client={clients.find(c => c.id === q.client_id) ?? null}
            vatRate={q.vat_rate ?? 15}
            onClaimCreated={c => setVOCreatedClaims(prev => [c, ...prev])}
            onVOsChanged={setLiveVOs}
            onVOItemsCreated={handleVOItemsCreated}
          />
        </div>
      )}
      {tabAccessible.snag && (
        <div style={{ display: activeTab === 'snag' ? undefined : 'none' }}>
          <SnagTab quoteId={q.id} portalAccountId={portalAccountId} />
        </div>
      )}
      {tabAccessible.coc && (
        <div style={{ display: activeTab === 'coc' ? undefined : 'none' }}>
          <COCTab quoteId={q.id} initialCOC={coc} cocPrefix={cocPrefix} companyCode={companyCode}
            projectAddress={q.project_address ?? null}
            clientName={q.client?.client_name ?? null}
            clientEmail={q.client?.email ?? null} />
        </div>
      )}
      <div style={{ display: activeTab === 'materials' ? undefined : 'none' }}>
        <MaterialsTab quoteId={q.id} />
      </div>

      {/* Quote tab content */}
      <div style={{ display: activeTab === 'quote' ? undefined : 'none' }}>

      {/* Header card — condensed summary when locked, form when editable */}
      {locked ? (
        <div className="rounded-2xl p-5 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          {/* Contract value banner */}
          <div className="flex items-start justify-between pb-4 mb-4" style={{ borderBottom: `1px solid ${S.border}` }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Contract Value</p>
              <p className="text-2xl font-bold" style={{ color: S.accent }}>{fmtR(contractTotal)}</p>
              {approvedVOTotal !== 0 && (
                <p className="text-xs mt-0.5 font-medium" style={{ color: S.green }}>
                  +{fmtR(approvedVOTotal)} approved VOs → {fmtR(revisedTotal)} revised
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: S.muted }}>Contract Type</p>
              <p className="text-sm font-semibold" style={{ color: S.text }}>
                {CONTRACT_TYPES.find(ct => ct.value === q.contract_type)?.label ?? 'Lump Sum'}
              </p>
              {q.payment_terms_days != null && (
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.payment_terms_days}-day payment terms</p>
              )}
            </div>
          </div>
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
              {(q.client.qs_name || q.client.qs_email) && (
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  QS: {[q.client.qs_name, q.client.qs_email].filter(Boolean).join(' · ')}
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
              { label: 'Project Type',      value: q.project_type ? q.project_type.charAt(0).toUpperCase() + q.project_type.slice(1) : null },
              { label: 'Quote Date',        value: q.quoted_date ?? null },
              { label: 'Est. Completion',   value: q.expected_completion_date ?? null },
              { label: 'VAT Rate',          value: q.vat_rate != null ? `${q.vat_rate}%` : null },
              { label: 'Retention',         value: q.retention_percentage > 0 ? `${q.retention_percentage}%` : null },
              { label: 'Defects Liability', value: q.defects_liability_period_days ? `${q.defects_liability_period_days} days` : null },
              { label: 'Drawing REF',       value: q.drawing_reference ?? null },
              { label: 'Technicians',       value: (() => { const ids = [...(q.staff_id ? [q.staff_id] : []), ...(q.additional_staff_ids ?? [])]; const names = ids.map(id => staff.find(s => s.id === id)?.name).filter(Boolean); return names.length > 0 ? names.join(', ') : null })() },
              { label: 'Created',           value: new Date(q.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + (q.created_by_name ? ` by ${q.created_by_name}` : '') },
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
          {/* Technicians — always editable even when project is locked */}
          {staff.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${S.border}` }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: S.muted }}>Technicians</label>
              <StaffMultiSelect
                selectedIds={[
                  ...(q.staff_id ? [q.staff_id] : []),
                  ...(q.additional_staff_ids ?? []),
                ]}
                staff={staff}
                onChange={ids => setQ(p => ({
                  ...p,
                  staff_id: ids[0] ?? null,
                  additional_staff_ids: ids.slice(1),
                }))}
              />
            </div>
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
                const found = id ? clients.find(c => c.id === id) : null
                setQ(p => ({ ...p, client_id: id, project_address: p.project_address || found?.address || p.project_address }))
                setClientDisplay(name)
                setClientCompany(found?.company ?? '')
                setClientQsName(found?.qs_name ?? '')
                setClientQsEmail(found?.qs_email ?? '')
                if (id && !clients.find(c => c.id === id)) {
                  setClients(cs => [...cs, { id, client_name: name, company: null, email: null, address: null, qs_name: null, qs_email: null }].sort((a, b) => a.client_name.localeCompare(b.client_name)))
                }
              }}
            />
          </div>

          {/* Assign Technicians */}
          {staff.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Technicians</label>
              <StaffMultiSelect
                selectedIds={[
                  ...(q.staff_id ? [q.staff_id] : []),
                  ...(q.additional_staff_ids ?? []),
                ]}
                staff={staff}
                onChange={ids => setQ(p => ({
                  ...p,
                  staff_id: ids[0] ?? null,
                  additional_staff_ids: ids.slice(1),
                }))}
              />
            </div>
          )}

          {/* Project address */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project Address</label>
            <input value={q.project_address ?? ''} onChange={e => setQ(p => ({ ...p, project_address: e.target.value || null }))}
              placeholder="Site address"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* Company name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Company Name</label>
            <input value={clientCompany} onChange={e => setClientCompany(e.target.value)}
              placeholder="Client company"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* QS Name + QS Email */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>QS Name</label>
            <input value={clientQsName} onChange={e => setClientQsName(e.target.value)}
              placeholder="Quantity surveyor"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>QS Email</label>
            <input type="email" value={clientQsEmail} onChange={e => setClientQsEmail(e.target.value)}
              placeholder="qs@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Tax / VAT Number</label>
            <input value={clientVatNumber} onChange={e => setClientVatNumber(e.target.value)}
              placeholder="4123456789"
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

          {/* Contract type */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Contract Type</label>
            <select value={q.contract_type ?? 'lump_sum'} onChange={e => setQ(p => ({ ...p, contract_type: e.target.value as ElecQuote['contract_type'] }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
              {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>

          {/* Payment terms */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Payment Terms (days)</label>
            <input type="number" value={q.payment_terms_days || ''} placeholder="e.g. 30"
              onChange={e => setQ(p => ({ ...p, payment_terms_days: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* VAT rate */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>VAT Rate (%)</label>
            <input type="number" value={q.vat_rate ?? ''} placeholder="15"
              onChange={e => setQ(p => ({ ...p, vat_rate: e.target.value === '' ? null : parseFloat(e.target.value) }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* Retention */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Retention (%)</label>
            <input type="number" value={q.retention_percentage ?? 0} onChange={e => setQ(p => ({ ...p, retention_percentage: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* Defects liability */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Defects Liability (days)</label>
            <input type="number" value={q.defects_liability_period_days || ''} placeholder="e.g. 365"
              onChange={e => setQ(p => ({ ...p, defects_liability_period_days: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
          </div>

          {/* Drawing REF */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Drawing REF <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input value={q.drawing_reference ?? ''} placeholder="e.g. E-03 Rev 2"
              onChange={e => setQ(p => ({ ...p, drawing_reference: e.target.value || null }))}
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

        <DragDropContext onDragEnd={onDragEnd}>
          {freeItems.length > 0 && (
            <div className="rounded-2xl p-3 mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <div style={{ width: 14 }} />
                <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 160 }}>Description</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: S.muted, width: 60 }}>Unit</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 72 }}>Qty</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 82 }}>Cost</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 65 }}>Mkup</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 72 }}>Rate</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 82 }}>Subtotal</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 82 }}>+Labour</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 92 }}>Total</div>
                <div style={{ width: 28 }} />
              </div>
              <Droppable droppableId="free" type="ITEM">
                {(dropProvided) => (
                  <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                    {freeItems.map((item, idx) => (
                      <Draggable key={item.id} draggableId={item.id} index={idx} isDragDisabled={!!locked}>
                        {(dragProvided) => (
                          <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                            <LineItemRow item={item}
                              onChange={u => setFreeItems(items => items.map(i => i.id === u.id ? u : i))}
                              onDelete={() => deleteFreeItem(item.id)}
                              portalAccountId={portalAccountId} locked={locked}
                              dragHandleProps={dragProvided.dragHandleProps} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}

          <Droppable droppableId="sections" type="SECTION">
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                {sections.map((section, idx) => (
                  <Draggable key={section.id} draggableId={section.id} index={idx} isDragDisabled={!!locked}>
                    {(dragProvided) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                        <SectionBlock section={section}
                          onChange={u => setSections(ss => ss.map(s => s.id === u.id ? u : s))}
                          onDelete={() => deleteSection(section.id)}
                          onAddItem={() => setSections(ss => ss.map(s => s.id === section.id
                            ? { ...s, items: [...s.items, newItem(q.id, s.id, s.items.length)] } : s))}
                          onDeleteItem={itemId => deleteSectionItem(section.id, itemId)}
                          portalAccountId={portalAccountId} locked={locked}
                          dragHandleProps={dragProvided.dragHandleProps} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

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
        <div className="space-y-2">
          {hasCostData && (
            <>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Revenue (ex VAT)</span>
                <span className="font-medium" style={{ color: S.text }}>{fmtR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Cost (ex VAT)</span>
                <span className="font-medium" style={{ color: S.text }}>{fmtR(itemCostTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: S.muted }}>Material Profit</span>
                <span className="font-medium" style={{ color: materialProfit >= 0 ? S.green : S.danger }}>{fmtR(materialProfit)}</span>
              </div>
              {labourTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: S.muted }}>+ Labour Profit</span>
                  <span className="font-medium" style={{ color: S.green }}>{fmtR(labourTotal)}</span>
                </div>
              )}
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

      {/* PDF download + Send to Client — placed below totals so user reviews before acting */}
      <div className="flex items-center justify-end gap-3 mb-4">
        <a href={`/api/supplier-portal/quoting/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
          <Download size={14} /> Download PDF
        </a>
        {q.status === 'draft' && (
          <button onClick={openSendModal}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: S.accent, color: '#fff' }}>
            <Send size={14} /> Send to Client
          </button>
        )}
      </div>

      {/* Secondary actions strip */}
      {q.status === 'quoted' && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => void transition('draft')} disabled={transitioning}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: S.bg, color: S.muted, border: `1px solid ${S.border}` }}>
            ← Back to Draft
          </button>
          <button onClick={openSendModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(58,124,165,0.1)', color: S.accent, border: `1px solid rgba(58,124,165,0.25)` }}>
            <Send size={13} /> Send Again
          </button>
        </div>
      )}
      {q.status === 'in_progress' && (
        <p className="text-xs" style={{ color: S.muted }}>
          Project in progress — use the Claims tab to submit invoices.
        </p>
      )}

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

      {/* ── Recon / Sign-off Modal ── */}
      {showReconModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReconModal(false) }}>
          <div className="rounded-2xl w-full max-w-sm p-6 shadow-2xl" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold" style={{ color: S.text }}>Recon / Sign-off Sheet</p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>Quote items + variation orders with tick boxes</p>
              </div>
              <button onClick={() => setShowReconModal(false)} className="p-1.5 rounded-lg"
                style={{ color: S.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = S.border)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={15} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`/api/supplier-portal/quoting/quotes/${q.id}/recon-pdf`} target="_blank" rel="noreferrer"
                onClick={() => setShowReconModal(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: S.accent, color: '#fff', textDecoration: 'none' }}>
                <Printer size={16} />
                <div>
                  <p>Print</p>
                  <p className="text-xs font-normal opacity-80">Opens in browser — use Ctrl+P / ⌘P</p>
                </div>
              </a>
              <a href={`/api/supplier-portal/quoting/quotes/${q.id}/recon-pdf?mode=download`} download
                onClick={() => setShowReconModal(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: S.bg, color: S.text, border: `1px solid ${S.border}`, textDecoration: 'none' }}>
                <Download size={16} />
                <div>
                  <p>Download PDF</p>
                  <p className="text-xs font-normal" style={{ color: S.muted }}>Save to your device</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
