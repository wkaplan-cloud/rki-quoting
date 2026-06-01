'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Trash2, X, Check, AlertCircle, BookOpen } from 'lucide-react'
import type { ElecItemLibrary } from '@/lib/elec-types'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

export const PRICE_BOOK_CATEGORIES = [
  'Cable',
  'Conduit & Trunking',
  'DB Boards & Breakers',
  'Switching & Sockets',
  'Lighting',
  'Earth & Bonding',
  'Labour',
  'Preliminary',
  'Other',
]

const UNITS = ['nr', 'm']

function fmtR(n: number | null | undefined) {
  if (n == null) return '—'
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function emptyForm() {
  return { description: '', category: '', unit: 'nr', default_cost_rate: '', default_markup_percent: '', default_labour_rate: '' }
}

interface Props {
  portalAccountId: string
  initialItems: ElecItemLibrary[]
}

export function PriceBookClient({ portalAccountId, initialItems }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<ElecItemLibrary[]>(initialItems)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ElecItemLibrary | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(i => {
      const matchesSearch = !q || i.description.toLowerCase().includes(q)
      const matchesCat = catFilter === 'All' || (catFilter === 'Uncategorized' ? !i.category : i.category === catFilter)
      return matchesSearch && matchesCat
    })
  }, [items, search, catFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, ElecItemLibrary[]>()
    for (const item of filtered) {
      const key = item.category || 'Uncategorized'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    // Sort groups: known categories first in order, then Uncategorized last
    const order = [...PRICE_BOOK_CATEGORIES, 'Uncategorized']
    return [...map.entries()].sort(([a], [b]) => {
      const ai = order.indexOf(a), bi = order.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [filtered])

  const allCats = useMemo(() => {
    const used = new Set(items.map(i => i.category || 'Uncategorized'))
    const order = [...PRICE_BOOK_CATEGORIES, 'Uncategorized']
    return order.filter(c => used.has(c))
  }, [items])

  function openAdd() {
    setEditingItem(null)
    setForm(emptyForm())
    setSaveError('')
    setShowModal(true)
  }

  function openEdit(item: ElecItemLibrary) {
    setEditingItem(item)
    setForm({
      description: item.description,
      category: item.category ?? '',
      unit: item.unit ?? 'nr',
      default_cost_rate: item.default_cost_rate != null ? String(item.default_cost_rate) : '',
      default_markup_percent: item.default_markup_percent != null ? String(item.default_markup_percent) : '',
      default_labour_rate: item.default_labour_rate != null ? String(item.default_labour_rate) : '',
    })
    setSaveError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingItem(null)
    setSaveError('')
  }

  async function handleSave() {
    if (!form.description.trim()) { setSaveError('Description is required'); return }
    setSaving(true); setSaveError('')
    const payload = {
      portal_account_id: portalAccountId,
      description: form.description.trim(),
      category: form.category || null,
      unit: form.unit || null,
      default_cost_rate: form.default_cost_rate ? parseFloat(form.default_cost_rate) : null,
      default_markup_percent: form.default_markup_percent ? parseFloat(form.default_markup_percent) : null,
      default_labour_rate: form.default_labour_rate ? parseFloat(form.default_labour_rate) : null,
    }
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('elec_item_library')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingItem.id)
        if (error) throw error
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i))
      } else {
        const { data, error } = await supabase
          .from('elec_item_library')
          .insert({ ...payload, usage_count: 0 })
          .select()
          .single()
        if (error) throw error
        setItems(prev => [...prev, data as ElecItemLibrary])
      }
      closeModal()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const { error } = await supabase.from('elec_item_library').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
    setDeleting(false)
    setDeleteId(null)
  }

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(58,124,165,0.1)' }}>
              <BookOpen size={18} style={{ color: S.accent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: S.text }}>Price Book</h1>
              <p className="text-xs" style={{ color: S.muted }}>{items.length} item{items.length !== 1 ? 's' : ''} · select when adding line items to quotes &amp; VOs</p>
            </div>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: S.accent }}>
            <Plus size={15} /> Add Item
          </button>
        </div>

        {/* Search + category filter */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl outline-none"
                style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['All', ...allCats].map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: catFilter === c ? S.accent : S.input,
                  color: catFilter === c ? '#fff' : S.muted,
                  border: `1px solid ${catFilter === c ? S.accent : S.border}`,
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Items grouped by category */}
        {grouped.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <BookOpen size={32} className="mx-auto mb-3" style={{ color: S.border }} />
            <p className="text-sm font-medium mb-1" style={{ color: S.text }}>
              {search || catFilter !== 'All' ? 'No items match your filter' : 'Your price book is empty'}
            </p>
            <p className="text-xs" style={{ color: S.muted }}>
              {search || catFilter !== 'All' ? 'Try a different search or category' : 'Add items to build your standard catalog — electricians will search these when writing quotes.'}
            </p>
            {!search && catFilter === 'All' && (
              <button onClick={openAdd}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: S.accent }}>
                Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([category, catItems]) => (
              <div key={category} className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                {/* Category header */}
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}`, background: '#FAFAFA' }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: S.accent }}>{category}</span>
                  <span className="text-xs" style={{ color: S.muted }}>{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div className="grid px-5 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 60px 110px 80px 110px 72px', color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                  <span>Description</span>
                  <span>Unit</span>
                  <span className="text-right">Cost</span>
                  <span className="text-right">Markup</span>
                  <span className="text-right">Labour</span>
                  <span />
                </div>

                {/* Item rows */}
                {catItems.map((item, idx) => (
                  <div key={item.id}
                    className="grid items-center px-5 py-3"
                    style={{
                      gridTemplateColumns: '1fr 60px 110px 80px 110px 72px',
                      borderTop: idx > 0 ? `1px solid ${S.border}` : undefined,
                    }}>
                    <span className="text-sm font-medium pr-4" style={{ color: S.text }}>{item.description}</span>
                    <span className="text-sm" style={{ color: S.muted }}>{item.unit ?? '—'}</span>
                    <span className="text-sm text-right" style={{ color: item.default_cost_rate != null ? S.muted : S.border }}>
                      {fmtR(item.default_cost_rate)}
                    </span>
                    <span className="text-sm text-right font-medium" style={{ color: item.default_markup_percent != null ? S.text : S.border }}>
                      {item.default_markup_percent != null ? `${item.default_markup_percent}%` : '—'}
                    </span>
                    <span className="text-sm text-right" style={{ color: item.default_labour_rate != null ? S.muted : S.border }}>
                      {fmtR(item.default_labour_rate)}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: S.muted }}
                        onMouseEnter={e => e.currentTarget.style.color = S.accent}
                        onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(item.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: S.muted }}
                        onMouseEnter={e => e.currentTarget.style.color = S.danger}
                        onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
              <h2 className="font-bold text-sm" style={{ color: S.text }}>{editingItem ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg" style={{ color: S.muted }}><X size={15} /></button>
            </div>
            <div className="p-5 space-y-4">

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. 25mm² 3-core armoured cable"
                  className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: form.category ? S.text : S.muted }}>
                    <option value="">Uncategorized</option>
                    {PRICE_BOOK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Cost (R)</label>
                  <input type="number" value={form.default_cost_rate} onChange={e => setForm(f => ({ ...f, default_cost_rate: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-right"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Markup %</label>
                  <input type="number" value={form.default_markup_percent} onChange={e => setForm(f => ({ ...f, default_markup_percent: e.target.value }))}
                    placeholder="0" min="0" step="0.1"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-right"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Labour (R)</label>
                  <input type="number" value={form.default_labour_rate} onChange={e => setForm(f => ({ ...f, default_labour_rate: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-right"
                    style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
                </div>
              </div>

              {(() => {
                const cost = parseFloat(form.default_cost_rate)
                const markup = parseFloat(form.default_markup_percent)
                const labour = parseFloat(form.default_labour_rate)
                if (!isFinite(cost) || cost <= 0) return null
                const sell = cost * (1 + (isFinite(markup) ? markup : 0) / 100) + (isFinite(labour) ? labour : 0)
                return (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium"
                    style={{ background: S.input, border: `1px solid ${S.border}` }}>
                    <span style={{ color: S.muted }}>Sell rate</span>
                    <span style={{ color: S.accent }}>{fmtR(sell)}</span>
                  </div>
                )
              })()}

              {saveError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
                  <AlertCircle size={13} />{saveError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>
                  Cancel
                </button>
                <button onClick={() => void handleSave()} disabled={saving || !form.description.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {saving ? 'Saving…' : <><Check size={14} />{editingItem ? 'Save Changes' : 'Add Item'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 className="font-bold text-sm mb-2" style={{ color: S.text }}>Delete item?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>This removes it from the price book. Existing quotes and job cards are not affected.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>
                Cancel
              </button>
              <button onClick={() => void handleDelete(deleteId)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: S.danger }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
