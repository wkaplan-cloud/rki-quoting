'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Package, Pencil, Trash2, X, Check, AlertCircle, Search, Loader2 } from 'lucide-react'
import type { ElecKit, ElecItemLibrary } from '@/lib/elec-types'
import { tradeUnits } from '@/lib/portal-theme'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

const UNITS = tradeUnits('installer')

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const round2 = (n: number) => Math.round(n * 100) / 100
const toNum = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null }
const toStr = (n: number | null | undefined) => (n == null ? '' : String(n))

/** One kit line as typed — strings, so an emptied field stays empty. */
interface LineDraft {
  key: string
  description: string
  unit: string
  quantity: string
  cost: string
  markup: string
  sell: string
  labour: string
}

function blankLine(): LineDraft {
  return { key: crypto.randomUUID(), description: '', unit: 'nr', quantity: '1', cost: '', markup: '', sell: '', labour: '' }
}

function kitSell(kit: ElecKit) {
  return kit.items.reduce((s, i) => s + i.quantity * (i.quoted_unit_rate + (i.labour_rate ?? 0)), 0)
}
function kitCost(kit: ElecKit): number | null {
  if (kit.items.some(i => i.cost_unit_rate == null)) return null
  return kit.items.reduce((s, i) => s + i.quantity * (i.cost_unit_rate ?? 0), 0)
}

interface Props {
  portalAccountId: string
  initialKits: ElecKit[]
}

export function KitsClient({ portalAccountId, initialKits }: Props) {
  const [kits, setKits] = useState(initialKits)
  const [editing, setEditing] = useState<ElecKit | 'new' | null>(null)
  const [deleteKit, setDeleteKit] = useState<ElecKit | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function reload() {
    const res = await fetch('/api/supplier-portal/quoting/kits')
    const d = await res.json() as { kits?: ElecKit[] }
    if (res.ok && d.kits) setKits(d.kits)
  }

  async function handleDelete() {
    if (!deleteKit) return
    setDeleting(true)
    const res = await fetch(`/api/supplier-portal/quoting/kits/${deleteKit.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) setKits(ks => ks.filter(k => k.id !== deleteKit.id))
    setDeleteKit(null)
  }

  return (
    <div className="min-h-screen" style={{ background: S.bg }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--qh-accent-rgb),0.1)' }}>
              <Package size={18} style={{ color: S.accent }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: S.text }}>Kits</h1>
              <p className="text-xs" style={{ color: S.muted }}>Packages you quote often — drop one into a room in a single click</p>
            </div>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: S.accent }}>
            <Plus size={15} /> New Kit
          </button>
        </div>

        {kits.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <Package size={32} className="mx-auto mb-3" style={{ color: S.border }} />
            <p className="text-sm font-medium mb-1" style={{ color: S.text }}>No kits yet</p>
            <p className="text-xs max-w-sm mx-auto" style={{ color: S.muted }}>
              Build your standard packages once — a 4-camera CCTV system, a cinema room, a Control4 starter — and add them to any quote.
            </p>
            <button onClick={() => setEditing('new')}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>
              Build your first kit
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {kits.map(kit => {
              const sell = kitSell(kit)
              const cost = kitCost(kit)
              const margin = cost != null && sell > 0 ? (sell - cost) / sell * 100 : null
              return (
                <div key={kit.id} className="rounded-2xl p-5 flex flex-col" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: S.text }}>{kit.name}</p>
                      {kit.description && <p className="text-xs mt-0.5" style={{ color: S.muted }}>{kit.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditing(kit)} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label={`Edit ${kit.name}`}
                        onMouseEnter={e => e.currentTarget.style.color = S.accent}
                        onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteKit(kit)} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label={`Delete ${kit.name}`}
                        onMouseEnter={e => e.currentTarget.style.color = S.danger}
                        onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 flex-1">
                    {kit.items.slice(0, 5).map(i => (
                      <li key={i.id} className="flex justify-between gap-3 text-xs">
                        <span className="truncate" style={{ color: S.text }}>{i.quantity} × {i.description}</span>
                      </li>
                    ))}
                    {kit.items.length > 5 && <li className="text-xs" style={{ color: S.muted }}>+ {kit.items.length - 5} more</li>}
                  </ul>
                  <div className="flex items-end justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${S.border}` }}>
                    <span className="text-xs" style={{ color: S.muted }}>{kit.items.length} line{kit.items.length !== 1 ? 's' : ''}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: S.accent }}>{fmtR(sell)} <span className="text-[10px] font-medium" style={{ color: S.muted }}>ex VAT</span></p>
                      {margin != null && <p className="text-[11px]" style={{ color: margin >= 0 ? S.green : S.danger }}>{Math.round(margin * 10) / 10}% margin</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editing && (
        <KitEditor
          portalAccountId={portalAccountId}
          kit={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload() }}
        />
      )}

      {deleteKit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 className="font-bold text-sm mb-2" style={{ color: S.text }}>Delete “{deleteKit.name}”?</h3>
            <p className="text-sm mb-5" style={{ color: S.muted }}>Quotes it was already added to keep their lines.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteKit(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>Cancel</button>
              <button onClick={() => void handleDelete()} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: S.danger }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kit editor ───────────────────────────────────────────────────────────────

type CatalogueHit = Pick<ElecItemLibrary, 'id' | 'description' | 'unit' | 'sku' | 'brand' | 'default_cost_rate' | 'default_markup_percent' | 'default_unit_rate'>

function KitEditor({ portalAccountId, kit, onClose, onSaved }: {
  portalAccountId: string
  kit: ElecKit | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(kit?.name ?? '')
  const [description, setDescription] = useState(kit?.description ?? '')
  const [lines, setLines] = useState<LineDraft[]>(() => kit
    ? kit.items.map(i => ({
        key: i.id, description: i.description, unit: i.unit, quantity: toStr(i.quantity),
        cost: toStr(i.cost_unit_rate), markup: toStr(i.markup_percentage),
        sell: toStr(i.quoted_unit_rate), labour: toStr(i.labour_rate),
      }))
    : [])
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CatalogueHit[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = search.trim()
    // Drives a debounced lookup; synchronising with an external system is what an effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.length < 2) { setHits([]); return }
    const t = setTimeout(async () => {
      const safe = q.replace(/[,()%]/g, ' ')
      const { data } = await supabase
        .from('elec_item_library')
        .select('id, description, unit, sku, brand, default_cost_rate, default_markup_percent, default_unit_rate')
        .eq('portal_account_id', portalAccountId)
        .or(`description.ilike.%${safe}%,sku.ilike.%${safe}%,brand.ilike.%${safe}%`)
        .order('usage_count', { ascending: false })
        .limit(8)
      setHits((data ?? []) as CatalogueHit[])
    }, 200)
    return () => clearTimeout(t)
  }, [search, portalAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addFromCatalogue(hit: CatalogueHit) {
    const cost = hit.default_cost_rate
    const markup = hit.default_markup_percent
    const sell = hit.default_unit_rate ?? (cost != null ? round2(cost * (1 + (markup ?? 0) / 100)) : null)
    setLines(ls => [...ls, {
      key: crypto.randomUUID(),
      description: hit.brand && !hit.description.toLowerCase().startsWith(hit.brand.toLowerCase()) ? `${hit.brand} ${hit.description}` : hit.description,
      unit: hit.unit ?? 'nr', quantity: '1',
      cost: toStr(cost), markup: toStr(markup), sell: toStr(sell), labour: '',
    }])
    setSearch(''); setHits([])
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines(ls => ls.map(l => {
      if (l.key !== key) return l
      const next = { ...l, ...patch }
      const cost = toNum(next.cost)
      // Same rules as the quote editor: cost or markup drive the sell rate,
      // and a typed sell rate recalculates the markup.
      if (('cost' in patch || 'markup' in patch) && cost != null) {
        next.sell = toStr(round2(cost * (1 + (toNum(next.markup) ?? 0) / 100)))
      } else if ('sell' in patch && cost != null && cost > 0) {
        const sell = toNum(next.sell)
        if (sell != null) next.markup = toStr(Math.round((sell / cost - 1) * 1000) / 10)
      }
      return next
    }))
  }

  const total = lines.reduce((s, l) => s + (toNum(l.quantity) ?? 0) * ((toNum(l.sell) ?? 0) + (toNum(l.labour) ?? 0)), 0)

  async function handleSave() {
    setSaving(true); setError('')
    const payload = {
      name, description: description || null,
      items: lines.filter(l => l.description.trim()).map(l => ({
        description: l.description, unit: l.unit,
        quantity: toNum(l.quantity) ?? 0,
        cost_unit_rate: toNum(l.cost), markup_percentage: toNum(l.markup),
        quoted_unit_rate: toNum(l.sell) ?? 0, labour_rate: toNum(l.labour),
      })),
    }
    const res = await fetch(kit ? `/api/supplier-portal/quoting/kits/${kit.id}` : '/api/supplier-portal/quoting/kits', {
      method: kit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await res.json().catch(() => ({})) as { error?: string }
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Save failed'); return }
    onSaved()
  }

  const inputCls = 'px-2 py-1.5 text-sm rounded-lg outline-none'
  const inputStyle = { background: '#fff', border: `1px solid ${S.border}`, color: S.text }
  const hdr = (label: string, w: number, align: 'left' | 'right' = 'right') => (
    <div className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: S.muted, width: w, textAlign: align }}>{label}</div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${S.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: S.text }}>{kit ? 'Edit Kit' : 'New Kit'}</h2>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="kit-name" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Kit name *</label>
              <input id="kit-name" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <div>
              <label htmlFor="kit-desc" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Description</label>
              <input id="kit-desc" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
          </div>

          {/* Catalogue search */}
          <div className="relative">
            <label htmlFor="kit-search" className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>Add from catalogue</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.muted }} />
              <input id="kit-search" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl outline-none" style={{ background: S.input, border: `1px solid ${S.border}`, color: S.text }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: S.muted }}>Search by product, brand or SKU</p>
            {hits.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-1 rounded-xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                {hits.map(h => (
                  <button key={h.id} onClick={() => addFromCatalogue(h)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                    onMouseEnter={e => e.currentTarget.style.background = S.bg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span className="min-w-0">
                      <span className="block truncate" style={{ color: S.text }}>{h.description}</span>
                      {(h.brand || h.sku) && <span className="block text-[11px]" style={{ color: S.muted }}>{[h.brand, h.sku].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: S.muted }}>
                      {h.default_unit_rate != null ? fmtR(h.default_unit_rate) : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="rounded-xl p-3 overflow-x-auto" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
            {lines.length > 0 && (
              <div className="flex items-center gap-2 px-1 mb-1.5" style={{ minWidth: 760 }}>
                <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: S.muted, minWidth: 200 }}>Description</div>
                {hdr('Unit', 64, 'left')}{hdr('Qty', 60)}{hdr('Cost', 84)}{hdr('Mkup %', 62)}{hdr('Sell', 84)}{hdr('Labour', 76)}{hdr('Total', 92)}
                <div style={{ width: 28 }} />
              </div>
            )}
            {lines.map(l => {
              const lineTotal = (toNum(l.quantity) ?? 0) * ((toNum(l.sell) ?? 0) + (toNum(l.labour) ?? 0))
              return (
                <div key={l.key} className="flex items-center gap-2 mb-1.5" style={{ minWidth: 760 }}>
                  <input aria-label="Description" value={l.description} onChange={e => updateLine(l.key, { description: e.target.value })}
                    className={`flex-1 ${inputCls}`} style={{ ...inputStyle, minWidth: 200 }} />
                  <select aria-label="Unit" value={l.unit} onChange={e => updateLine(l.key, { unit: e.target.value })}
                    className={inputCls} style={{ ...inputStyle, width: 64 }}>
                    {[...UNITS, ...(UNITS.includes(l.unit) ? [] : [l.unit])].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input aria-label="Quantity" inputMode="decimal" value={l.quantity} onChange={e => updateLine(l.key, { quantity: e.target.value })}
                    className={`${inputCls} text-right`} style={{ ...inputStyle, width: 60 }} />
                  <input aria-label="Cost" inputMode="decimal" value={l.cost} onChange={e => updateLine(l.key, { cost: e.target.value })}
                    className={`${inputCls} text-right`} style={{ ...inputStyle, width: 84 }} />
                  <input aria-label="Markup %" inputMode="decimal" value={l.markup} onChange={e => updateLine(l.key, { markup: e.target.value })}
                    className={`${inputCls} text-right`} style={{ ...inputStyle, width: 62 }} />
                  <input aria-label="Sell rate" inputMode="decimal" value={l.sell} onChange={e => updateLine(l.key, { sell: e.target.value })}
                    className={`${inputCls} text-right`} style={{ ...inputStyle, width: 84 }} />
                  <input aria-label="Labour per unit" inputMode="decimal" value={l.labour} onChange={e => updateLine(l.key, { labour: e.target.value })}
                    className={`${inputCls} text-right`} style={{ ...inputStyle, width: 76 }} />
                  <div className="text-sm font-semibold text-right flex-shrink-0" style={{ color: S.text, width: 92 }}>{fmtR(lineTotal)}</div>
                  <button onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: S.muted }} aria-label="Remove line"
                    onMouseEnter={e => e.currentTarget.style.color = S.danger}
                    onMouseLeave={e => e.currentTarget.style.color = S.muted}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
            <button onClick={() => setLines(ls => [...ls, blankLine()])}
              className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: S.accent }}>
              <Plus size={12} /> Add blank line
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: S.muted }}>Kit total (ex VAT)</span>
            <span className="text-base font-bold" style={{ color: S.accent }}>{fmtR(total)}</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
              <AlertCircle size={13} />{error}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: S.accent }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : kit ? 'Save Kit' : 'Create Kit'}
          </button>
        </div>
      </div>
    </div>
  )
}
