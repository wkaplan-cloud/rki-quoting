'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ChevronLeft, Save, Plus, Trash2, ChevronDown, ChevronRight,
  AlertCircle, Check, GripVertical, FolderPlus
} from 'lucide-react'
import type { ElecQuote, ElecQuoteSection, ElecQuoteLineItem, ElecClient, ElecItemType, ElecQuoteStatus } from '@/lib/elec-types'

// ─── Colours ─────────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
type ItemState = Omit<ElecQuoteLineItem, 'created_at'> & { _expanded?: boolean }
type SectionState = Omit<ElecQuoteSection, 'created_at' | 'line_items'> & { items: ItemState[] }

function newItem(quoteId: string, sectionId: string | null, sortOrder: number): ItemState {
  return {
    id: crypto.randomUUID(), quote_id: quoteId, section_id: sectionId,
    description: '', unit: 'nr', item_type: 'both', drawing_reference: null,
    subcontractor_name: null, quoted_quantity: 1, quoted_unit_rate: 0,
    labour_rate: null, material_rate: null, as_built_quantity: null,
    as_built_unit_rate: null, variation_order_id: null, is_variation: false,
    sort_order: sortOrder, _expanded: false,
  }
}

function newSection(quoteId: string, sortOrder: number): SectionState {
  return { id: crypto.randomUUID(), quote_id: quoteId, title: '', sort_order: sortOrder, items: [] }
}

function itemTotal(item: ItemState) {
  return (item.quoted_quantity ?? 0) * (item.quoted_unit_rate ?? 0)
}

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Autocomplete description input ──────────────────────────────────────────
interface Suggestion { description: string; unit: string | null; item_type: string; default_unit_rate: number | null; default_labour_rate: number | null; default_material_rate: number | null }

function DescriptionInput({ value, onChange, onSelect, portalAccountId, locked }: {
  value: string; onChange: (v: string) => void
  onSelect: (s: Suggestion) => void; portalAccountId: string; locked?: boolean
}) {
  const supabase = createClient()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
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
      setOpen(results.length > 0)
    }, 200)
    return () => clearTimeout(t)
  }, [value, portalAccountId, locked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative flex-1">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={locked}
        placeholder="Description"
        className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
        style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, minWidth: 180 }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
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
  item: ItemState; onChange: (updated: ItemState) => void
  onDelete: () => void; portalAccountId: string; locked?: boolean
}) {
  const total = itemTotal(item)
  const exp = item._expanded ?? false

  function set(patch: Partial<ItemState>) { onChange({ ...item, ...patch }) }

  function handleSelectSuggestion(s: Suggestion) {
    set({
      description:     s.description,
      unit:            s.unit ?? item.unit,
      item_type:       (s.item_type as ElecItemType) ?? item.item_type,
      quoted_unit_rate: s.default_unit_rate ?? item.quoted_unit_rate,
      labour_rate:     s.default_labour_rate ?? item.labour_rate,
      material_rate:   s.default_material_rate ?? item.material_rate,
    })
  }

  const numInput = (val: number | null, cb: (n: number) => void, placeholder = '0') => (
    <input
      type="number"
      value={val ?? ''}
      onChange={e => cb(parseFloat(e.target.value) || 0)}
      disabled={locked}
      placeholder={placeholder}
      className="px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
      style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, width: 90 }}
    />
  )

  return (
    <div className="rounded-xl mb-1.5" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
      {/* Main row */}
      <div className="flex items-center gap-2 p-2">
        <GripVertical size={14} style={{ color: S.border, flexShrink: 0, cursor: 'grab' }} />

        <DescriptionInput
          value={item.description}
          onChange={v => set({ description: v })}
          onSelect={handleSelectSuggestion}
          portalAccountId={portalAccountId}
          locked={locked}
        />

        {/* Unit */}
        <select
          value={item.unit ?? 'nr'}
          onChange={e => set({ unit: e.target.value })}
          disabled={locked}
          className="px-2 py-1.5 text-sm rounded-lg outline-none"
          style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text, width: 72 }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        {/* Qty */}
        {numInput(item.quoted_quantity, v => set({ quoted_quantity: v }), 'Qty')}

        {/* Rate */}
        {numInput(item.quoted_unit_rate, v => set({ quoted_unit_rate: v }), 'Rate')}

        {/* Total */}
        <div className="text-sm font-semibold text-right" style={{ color: S.text, width: 100, flexShrink: 0 }}>
          {fmtR(total)}
        </div>

        {/* Expand / delete */}
        <button onClick={() => set({ _expanded: !exp })} className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: S.muted }}
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

      {/* Expanded fields */}
      {exp && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3 border-t" style={{ borderColor: S.border }}>
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
          {(item.item_type === 'both' || item.item_type === 'labour') && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Labour Rate</label>
              <input type="number" value={item.labour_rate ?? ''} onChange={e => set({ labour_rate: parseFloat(e.target.value) || null })}
                disabled={locked} placeholder="0.00"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
                style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          )}
          {(item.item_type === 'both' || item.item_type === 'material') && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Material Rate</label>
              <input type="number" value={item.material_rate ?? ''} onChange={e => set({ material_rate: parseFloat(e.target.value) || null })}
                disabled={locked} placeholder="0.00"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none text-right"
                style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          )}
          {item.item_type === 'subcontract' && (
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Subcontractor</label>
              <input value={item.subcontractor_name ?? ''} onChange={e => set({ subcontractor_name: e.target.value || null })}
                disabled={locked} placeholder="Company name"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg outline-none"
                style={{ background: locked ? S.bg : '#fff', border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────
function SectionBlock({ section, onChange, onDelete, onAddItem, onDeleteItem, portalAccountId, locked }: {
  section: SectionState; onChange: (s: SectionState) => void
  onDelete: () => void; onAddItem: () => void
  onDeleteItem: (itemId: string) => void; portalAccountId: string; locked?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const subtotal = section.items.reduce((s, i) => s + itemTotal(i), 0)

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ border: `1px solid ${S.border}`, background: S.card }}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(58,124,165,0.04)', borderBottom: collapsed ? 'none' : `1px solid ${S.border}` }}>
        <button onClick={() => setCollapsed(c => !c)} className="flex-shrink-0" style={{ color: S.muted }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <input
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          disabled={locked}
          placeholder="Section title (e.g. DB Board)"
          className="flex-1 bg-transparent text-sm font-semibold outline-none"
          style={{ color: S.text, minWidth: 0 }}
        />
        <span className="text-sm font-semibold flex-shrink-0" style={{ color: S.accent }}>{fmtR(subtotal)}</span>
        <span className="text-xs flex-shrink-0" style={{ color: S.muted }}>{section.items.length} item{section.items.length !== 1 ? 's' : ''}</span>
        {!locked && (
          <button onClick={onDelete} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = S.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="p-3">
          {/* Column labels */}
          {section.items.length > 0 && (
            <div className="flex items-center gap-2 px-2 mb-1.5">
              <div className="w-[14px]" />
              <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 180 }}>Description</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: S.muted, width: 72 }}>Unit</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 90 }}>Qty</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 90 }}>Rate</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 100 }}>Total</div>
              <div className="w-[52px]" />
            </div>
          )}

          {section.items.map(item => (
            <LineItemRow
              key={item.id}
              item={item}
              onChange={updated => onChange({ ...section, items: section.items.map(i => i.id === updated.id ? updated : i) })}
              onDelete={() => onDeleteItem(item.id)}
              portalAccountId={portalAccountId}
              locked={locked}
            />
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
  clients: Pick<ElecClient, 'id' | 'client_name' | 'company'>[]
}

export function QuoteEditor({ portalAccountId, quote: initialQuote, sections: initSections, items: initItems, clients }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Header state
  const [q, setQ] = useState(initialQuote)
  // Sections state: each has items[]
  const [sections, setSections] = useState<SectionState[]>(() =>
    initSections.map(s => ({
      ...s,
      items: initItems.filter(i => i.section_id === s.id)
        .map(i => ({ ...i, _expanded: false })),
    }))
  )
  // Items not in any section
  const [freeItems, setFreeItems] = useState<ItemState[]>(() =>
    initItems.filter(i => i.section_id === null).map(i => ({ ...i, _expanded: false }))
  )

  const [deletedSectionIds, setDeletedSectionIds] = useState<string[]>([])
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const locked = ['approved', 'in_progress', 'completed', 'cancelled'].includes(q.status)

  // Track dirty state
  useEffect(() => { setIsDirty(true) }, [q, sections, freeItems])
  useEffect(() => { setIsDirty(false) }, []) // don't mark dirty on mount

  // Computed totals
  const allItems = [...freeItems, ...sections.flatMap(s => s.items)]
  const subtotal  = allItems.reduce((s, i) => s + itemTotal(i), 0)
  const vatAmt    = subtotal * ((q.vat_rate ?? 15) / 100)
  const total     = subtotal + vatAmt
  const retention = subtotal * ((q.retention_percentage ?? 0) / 100)

  // Upsert item library for each saved item
  async function syncItemLibrary(items: ItemState[]) {
    for (const item of items) {
      if (!item.description.trim()) continue
      await supabase.from('elec_item_library').upsert({
        portal_account_id:     portalAccountId,
        description:           item.description.trim(),
        unit:                  item.unit,
        item_type:             item.item_type,
        default_unit_rate:     item.quoted_unit_rate,
        default_labour_rate:   item.labour_rate,
        default_material_rate: item.material_rate,
        usage_count:           1,
      }, { onConflict: 'portal_account_id,description' })
        .then(({ error }) => {
          if (!error) return
          // Increment usage count on conflict
          supabase.rpc('upsert_elec_item_library', {
            p_portal_account_id:     portalAccountId,
            p_description:           item.description.trim(),
            p_unit:                  item.unit,
            p_item_type:             item.item_type,
            p_default_unit_rate:     item.quoted_unit_rate,
            p_default_labour_rate:   item.labour_rate,
            p_default_material_rate: item.material_rate,
          })
        })
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError(''); setSaved(false)
    try {
      // 1. Update quote header
      const { error: qErr } = await supabase.from('elec_quotes').update({
        project_name:                  q.project_name,
        project_address:               q.project_address,
        client_id:                     q.client_id,
        project_type:                  q.project_type,
        contract_type:                 q.contract_type,
        vat_rate:                      q.vat_rate,
        retention_percentage:          q.retention_percentage,
        payment_terms_days:            q.payment_terms_days,
        liquidated_damages_per_day:    q.liquidated_damages_per_day,
        defects_liability_period_days: q.defects_liability_period_days,
        notes:                         q.notes,
        quoted_date:                   q.quoted_date,
        expected_completion_date:      q.expected_completion_date,
      }).eq('id', q.id)
      if (qErr) throw qErr

      // 2. Delete removed sections (cascades items)
      if (deletedSectionIds.length > 0) {
        await supabase.from('elec_quote_sections').delete().in('id', deletedSectionIds)
      }
      // 3. Delete removed free items
      if (deletedItemIds.length > 0) {
        await supabase.from('elec_quote_line_items').delete().in('id', deletedItemIds)
      }

      // 4. Upsert sections
      for (let si = 0; si < sections.length; si++) {
        const s = sections[si]
        await supabase.from('elec_quote_sections').upsert({
          id: s.id, quote_id: q.id, title: s.title, sort_order: si,
        })
        // 5. Upsert section items
        for (let ii = 0; ii < s.items.length; ii++) {
          const item = s.items[ii]
          await supabase.from('elec_quote_line_items').upsert({
            id: item.id, quote_id: q.id, section_id: s.id,
            description: item.description, unit: item.unit, item_type: item.item_type,
            drawing_reference: item.drawing_reference, subcontractor_name: item.subcontractor_name,
            quoted_quantity: item.quoted_quantity, quoted_unit_rate: item.quoted_unit_rate,
            labour_rate: item.labour_rate, material_rate: item.material_rate,
            is_variation: item.is_variation, sort_order: ii,
          })
        }
      }

      // 6. Upsert free items
      for (let ii = 0; ii < freeItems.length; ii++) {
        const item = freeItems[ii]
        await supabase.from('elec_quote_line_items').upsert({
          id: item.id, quote_id: q.id, section_id: null,
          description: item.description, unit: item.unit, item_type: item.item_type,
          drawing_reference: item.drawing_reference, subcontractor_name: item.subcontractor_name,
          quoted_quantity: item.quoted_quantity, quoted_unit_rate: item.quoted_unit_rate,
          labour_rate: item.labour_rate, material_rate: item.material_rate,
          is_variation: item.is_variation, sort_order: ii,
        })
      }

      // 7. Sync item library in background
      syncItemLibrary(allItems)

      setDeletedSectionIds([]); setDeletedItemIds([])
      setIsDirty(false); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setSaveError(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [q, sections, freeItems, deletedSectionIds, deletedItemIds, allItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // Status transitions
  async function transition(newStatus: ElecQuoteStatus, extra?: Partial<typeof q>) {
    const update = { status: newStatus, ...extra }
    await supabase.from('elec_quotes').update(update).eq('id', q.id)
    setQ(prev => ({ ...prev, ...update }))
    setIsDirty(false)
  }

  function addSection() {
    setSections(ss => [...ss, newSection(q.id, ss.length)])
    setIsDirty(true)
  }

  function addFreeItem() {
    setFreeItems(items => [...items, newItem(q.id, null, items.length)])
    setIsDirty(true)
  }

  function deleteSection(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    if (section) {
      // Track item IDs that were in DB (not just new local ones)
      const dbItemIds = section.items.map(i => i.id)
      setDeletedItemIds(ids => [...ids, ...dbItemIds])
    }
    setDeletedSectionIds(ids => [...ids, sectionId])
    setSections(ss => ss.filter(s => s.id !== sectionId))
    setIsDirty(true)
  }

  function deleteSectionItem(sectionId: string, itemId: string) {
    setDeletedItemIds(ids => [...ids, itemId])
    setSections(ss => ss.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s))
    setIsDirty(true)
  }

  function deleteFreeItem(itemId: string) {
    setDeletedItemIds(ids => [...ids, itemId])
    setFreeItems(items => items.filter(i => i.id !== itemId))
    setIsDirty(true)
  }

  const st = STATUS_CONFIG[q.status]

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/supplier-portal/quoting/quotes')}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: S.muted }}
          onMouseEnter={e => e.currentTarget.style.color = S.text}
          onMouseLeave={e => e.currentTarget.style.color = S.muted}>
          <ChevronLeft size={16} /> Quotes
        </button>
        <div className="flex-1" />
        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: S.bg, color: S.muted }}>{q.quote_number}</span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
      </div>

      {/* Project name */}
      <input
        value={q.project_name}
        onChange={e => setQ(prev => ({ ...prev, project_name: e.target.value }))}
        disabled={locked}
        placeholder="Project Name"
        className="w-full text-2xl font-bold bg-transparent outline-none mb-1"
        style={{ color: S.text, border: 'none' }}
      />

      {/* Header card */}
      <div className="rounded-2xl p-5 mb-4 grid grid-cols-2 gap-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        {/* Client */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Client</label>
          <select
            value={q.client_id ?? ''}
            onChange={e => setQ(prev => ({ ...prev, client_id: e.target.value || null }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: q.client_id ? S.text : S.muted }}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}{c.company ? ` — ${c.company}` : ''}</option>)}
          </select>
        </div>

        {/* Project address */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project Address</label>
          <input value={q.project_address ?? ''} onChange={e => setQ(p => ({ ...p, project_address: e.target.value || null }))}
            disabled={locked} placeholder="Site address"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>

        {/* Project type */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Project Type</label>
          <select value={q.project_type ?? ''} onChange={e => setQ(p => ({ ...p, project_type: (e.target.value || null) as ElecQuote['project_type'] }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: q.project_type ? S.text : S.muted }}>
            <option value="">Select type</option>
            {['residential','commercial','industrial','retail'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>

        {/* Contract type */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Contract Type</label>
          <select value={q.contract_type ?? 'lump_sum'} onChange={e => setQ(p => ({ ...p, contract_type: e.target.value as any }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }}>
            <option value="lump_sum">Lump Sum</option>
            <option value="re_measurement">Re-measurement</option>
            <option value="cost_plus">Cost Plus</option>
          </select>
        </div>

        {/* Quoted date */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Quote Date</label>
          <input type="date" value={q.quoted_date ?? ''} onChange={e => setQ(p => ({ ...p, quoted_date: e.target.value || null }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>

        {/* Expected completion */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Expected Completion</label>
          <input type="date" value={q.expected_completion_date ?? ''} onChange={e => setQ(p => ({ ...p, expected_completion_date: e.target.value || null }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>

        {/* VAT */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>VAT Rate (%)</label>
          <input type="number" value={q.vat_rate ?? 15} onChange={e => setQ(p => ({ ...p, vat_rate: parseFloat(e.target.value) || 15 }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>

        {/* Retention */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Retention (%)</label>
          <input type="number" value={q.retention_percentage ?? 0} onChange={e => setQ(p => ({ ...p, retention_percentage: parseFloat(e.target.value) || 0 }))}
            disabled={locked}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>

        {/* Notes — full width */}
        <div className="col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Notes</label>
          <textarea value={q.notes ?? ''} onChange={e => setQ(p => ({ ...p, notes: e.target.value || null }))}
            disabled={locked} rows={2} placeholder="Any notes for this quote…"
            className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
            style={{ background: locked ? S.bg : S.input, border: `1px solid ${S.border}`, color: S.text }} />
        </div>
      </div>

      {/* Sections + free items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: S.muted }}>Line Items</h2>
          {!locked && (
            <div className="flex items-center gap-2">
              <button onClick={addFreeItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
                <Plus size={12} /> Add item
              </button>
              <button onClick={addSection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ color: S.accent, background: 'rgba(58,124,165,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(58,124,165,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(58,124,165,0.08)'}>
                <FolderPlus size={12} /> Add section
              </button>
            </div>
          )}
        </div>

        {/* Free (unsectioned) items */}
        {freeItems.length > 0 && (
          <div className="rounded-2xl p-3 mb-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            {freeItems.length > 0 && (
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <div className="w-[14px]" />
                <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 180 }}>Description</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: S.muted, width: 72 }}>Unit</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 90 }}>Qty</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 90 }}>Rate</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: S.muted, width: 100 }}>Total</div>
                <div className="w-[52px]" />
              </div>
            )}
            {freeItems.map(item => (
              <LineItemRow key={item.id} item={item}
                onChange={updated => setFreeItems(items => items.map(i => i.id === updated.id ? updated : i))}
                onDelete={() => deleteFreeItem(item.id)}
                portalAccountId={portalAccountId} locked={locked} />
            ))}
          </div>
        )}

        {/* Sections */}
        {sections.map(section => (
          <SectionBlock key={section.id} section={section}
            onChange={updated => setSections(ss => ss.map(s => s.id === updated.id ? updated : s))}
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
      <div className="rounded-2xl p-5 mb-6" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <div className="space-y-2 max-w-sm ml-auto">
          <div className="flex justify-between text-sm">
            <span style={{ color: S.muted }}>Subtotal (ex VAT)</span>
            <span className="font-medium" style={{ color: S.text }}>{fmtR(subtotal)}</span>
          </div>
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
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-3 flex-wrap" style={{ background: S.card, border: `1px solid ${S.border}` }}>
        <span className="text-sm font-medium flex-1" style={{ color: S.muted }}>Status actions</span>
        {q.status === 'draft' && (
          <button onClick={() => transition('quoted', { quoted_date: new Date().toISOString().split('T')[0] })}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: S.accent }}>
            Send Quote →
          </button>
        )}
        {q.status === 'quoted' && <>
          <button onClick={() => transition('draft')}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: S.bg, color: S.muted }}>
            ← Back to Draft
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
          <span className="text-sm" style={{ color: S.muted }}>Project in progress — manage from the As-Built tab</span>
        )}
        {(q.status === 'quoted' || q.status === 'approved') && (
          <button onClick={() => { if (confirm('Cancel this quote?')) transition('cancelled') }}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#FEF2F2', color: S.danger }}>
            Cancel
          </button>
        )}
      </div>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 md:left-52"
          style={{ background: S.card, borderTop: `1px solid ${S.border}`, boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center gap-2">
            {saveError
              ? <><AlertCircle size={15} style={{ color: S.danger }} /><span className="text-sm" style={{ color: S.danger }}>{saveError}</span></>
              : saved
              ? <><Check size={15} style={{ color: S.green }} /><span className="text-sm" style={{ color: S.green }}>Saved</span></>
              : <span className="text-sm" style={{ color: S.muted }}>Unsaved changes</span>
            }
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
            style={{ background: S.accent }}>
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Quote'}
          </button>
        </div>
      )}
    </div>
  )
}
