'use client'
import { useState } from 'react'
import { Plus, X, Check, AlertTriangle, Archive, Pencil } from 'lucide-react'
import type { MfgPriceBookItem, MfgPriceBookItemType } from '@/lib/mfg-types'

const S = { card: '#FFFFFF', accent: '#1B4F8A', text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5', bg: '#F5F7F9' }

const UNITS = ['sheet','plank','meter','sqm','piece','litre','kg','hour','custom']
const UNIT_LABELS: Record<string, string> = { sqm: 'm²', hour: 'hour' }
const unitLabel = (u: string, custom?: string | null) => u === 'custom' ? (custom ?? 'custom') : (UNIT_LABELS[u] ?? u)

const DEFAULT_CATEGORY = { material: 'boards', hardware: 'hinges_rails', labour: 'labour_services' } as const

const BLANK = (): Partial<MfgPriceBookItem> => ({
  item_type: 'material', name: '', unit: 'sheet',
  unit_custom: '', cost_price: undefined, supplier_quoted: false,
  supplier_name: '', notes: '',
})

interface Props { initialItems: MfgPriceBookItem[] }

function Input({ value, onChange, placeholder, type='text', small }: { value: string; onChange: (v:string)=>void; placeholder?: string; type?: string; small?: boolean }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={type === 'number' ? 1 : undefined}
      className={`w-full px-3 ${small ? 'py-1.5 text-xs' : 'py-2.5 text-sm'} rounded-lg outline-none transition-colors`}
      style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}
      onFocus={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background='#fff' }}
      onBlur={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background=S.input }}
    />
  )
}

export function MfgPriceBookClient({ initialItems }: Props) {
  const [items, setItems]           = useState<MfgPriceBookItem[]>(initialItems)
  const [activeType, setActiveType] = useState<MfgPriceBookItemType | 'all'>('all')
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [draft, setDraft]           = useState<Partial<MfgPriceBookItem>>(BLANK())
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  const filtered = items.filter(i => {
    if (activeType !== 'all' && i.item_type !== activeType) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function startEdit(item: MfgPriceBookItem) {
    setDraft({ ...item, cost_price: item.cost_price ?? undefined })
    setEditingId(item.id)
    setShowForm(true)
  }

  function resetForm() { setDraft(BLANK()); setEditingId(null); setShowForm(false); setError('') }

  async function handleSave() {
    if (!draft.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    const type = draft.item_type ?? 'material'
    const payload = {
      item_type: type,
      category: DEFAULT_CATEGORY[type as keyof typeof DEFAULT_CATEGORY],
      name: draft.name?.trim(),
      unit: draft.unit, unit_custom: draft.unit === 'custom' ? draft.unit_custom : null,
      cost_price: draft.supplier_quoted ? null : (draft.cost_price ?? null),
      supplier_quoted: draft.supplier_quoted ?? false,
      supplier_name: draft.supplier_name || null,
    }
    const url = editingId ? `/api/supplier-portal/manufacturing/price-book/${editingId}` : '/api/supplier-portal/manufacturing/price-book'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError((d as { error?: string }).error ?? 'Save failed'); return }
    const saved = await res.json()
    if (editingId) {
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, ...payload } as MfgPriceBookItem : i))
    } else {
      setItems(prev => [...prev, saved as MfgPriceBookItem])
    }
    resetForm()
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/supplier-portal/manufacturing/price-book/${id}`, { method: 'DELETE' })
    if (res.ok) { setItems(prev => prev.filter(i => i.id !== id)); setConfirmArchiveId(null) }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {(['all','material','hardware','labour'] as const).map(t => (
            <button key={t} onClick={() => setActiveType(t)}
              className="px-4 py-2 text-xs font-semibold transition-colors"
              style={{ background: activeType === t ? S.accent : S.card, color: activeType === t ? '#fff' : S.muted }}>
              {t === 'all' ? 'All' : t === 'material' ? 'Materials' : t === 'hardware' ? 'Hardware' : 'Labour'}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
          className="flex-1 min-w-[160px] px-3.5 py-2 text-sm rounded-lg outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: S.text }} />
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: S.accent }}>
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: S.muted }}>
          <p className="text-sm">No items yet. Add your first material or hardware item.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          {filtered.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors"
              style={{ background: S.card, borderTop: idx > 0 ? `1px solid ${S.border}` : undefined }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: S.text }}>{item.name}</span>
                  {item.supplier_quoted && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#FEF3C7', color: '#92400E' }}>
                      <AlertTriangle size={8} /> varies
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  {item.item_type === 'material' ? 'Material' : item.item_type === 'hardware' ? 'Hardware' : 'Labour'} · per {unitLabel(item.unit, item.unit_custom)}
                  {item.supplier_name && ` · ${item.supplier_name}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {item.supplier_quoted ? (
                  <span className="text-sm" style={{ color: S.muted }}>⚠ per quote</span>
                ) : (
                  <span className="text-sm font-semibold" style={{ color: S.text }}>
                    R {item.cost_price?.toFixed(2) ?? '—'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: S.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.input)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => setConfirmArchiveId(item.id)} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: S.muted }}
                  onMouseEnter={e => (e.currentTarget.style.background = S.input)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Archive size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={resetForm}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: S.text }}>{editingId ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={resetForm} style={{ color: S.muted }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Type</label>
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                  {(['material','hardware','labour'] as const).map(t => (
                    <button key={t} onClick={() => setDraft(d => ({ ...d, item_type: t, unit: t === 'labour' ? 'hour' : d.unit }))}
                      className="flex-1 py-2 text-xs font-semibold transition-colors"
                      style={{ background: draft.item_type === t ? S.accent : S.input, color: draft.item_type === t ? '#fff' : S.muted }}>
                      {t === 'material' ? 'Material' : t === 'hardware' ? 'Hardware' : 'Labour'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Name</label>
                <Input value={draft.name ?? ''} onChange={v => setDraft(d => ({ ...d, name: v }))} placeholder="e.g. Veneer Board — Walnut 18mm" />
              </div>
              {/* Unit */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Unit</label>
                  <select value={draft.unit ?? 'sheet'} onChange={e => setDraft(d => ({ ...d, unit: e.target.value as MfgPriceBookItem['unit'] }))}
                    className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
                    style={{ background: S.input, border: `1.5px solid ${S.border}`, color: S.text }}>
                    {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u] ?? (u.charAt(0).toUpperCase()+u.slice(1))}</option>)}
                  </select>
                </div>
                {draft.unit === 'custom' && (
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Custom unit</label>
                    <Input value={draft.unit_custom ?? ''} onChange={v => setDraft(d => ({ ...d, unit_custom: v }))} placeholder="e.g. m²" />
                  </div>
                )}
              </div>
              {/* Supplier quoted toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setDraft(d => ({ ...d, supplier_quoted: !d.supplier_quoted }))}
                    className="relative rounded-full transition-colors flex-shrink-0"
                    style={{ background: draft.supplier_quoted ? S.accent : S.border, width: 36, height: 20 }}>
                    <div className="absolute top-0.5 transition-transform rounded-full bg-white shadow"
                      style={{ width: 16, height: 16, left: 2, transform: draft.supplier_quoted ? 'translateX(16px)' : 'translateX(0)' }} />
                  </div>
                  <span className="text-sm" style={{ color: S.text }}>Price varies — enter per quote</span>
                </label>
                {draft.supplier_quoted && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    <AlertTriangle size={10} /> Supplier quoted
                  </span>
                )}
              </div>
              {/* Cost price */}
              {!draft.supplier_quoted && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Cost Price (R)</label>
                  <Input type="number" value={draft.cost_price !== undefined && draft.cost_price !== null ? String(draft.cost_price) : ''}
                    onChange={v => setDraft(d => ({ ...d, cost_price: v === '' ? undefined : parseFloat(v) }))} placeholder="0.00" />
                </div>
              )}
              {/* Supplier */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>Supplier (optional)</label>
                <Input value={draft.supplier_name ?? ''} onChange={v => setDraft(d => ({ ...d, supplier_name: v }))} placeholder="e.g. Timber City" />
              </div>
            </div>

            {error && <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: S.accent }}>
                <Check size={14} /> {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add to Price Book'}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirm modal */}
      {confirmArchiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmArchiveId(null)}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ background: S.card }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: S.text }}>Archive item?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>This item will be hidden from the price book. Historical quotes that use it are preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => handleArchive(confirmArchiveId)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#DC2626' }}>
                Archive
              </button>
              <button onClick={() => setConfirmArchiveId(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
