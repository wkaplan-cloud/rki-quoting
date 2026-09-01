'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, ClipboardList, RefreshCw, Unlink, ReceiptText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore, newId } from '@/lib/studio/store'
import { createClient } from '@/lib/supabase/client'
import type { StudioSpec, MaterialEntry, SpecSupplierOption } from '@/lib/studio/types'
import { Combobox } from '@/components/ui/Combobox'
import { FabricSearch } from '@/components/ui/FabricSearch'
import { CategorySpecFields } from '@/components/shared/CategorySpecFields'
import { CATEGORIES, categoryCoversDimensions, type CategoryKey } from '@/lib/sourcing-categories'

const ASSET_LABEL_SYNC_DEBOUNCE = 500

const MATERIAL_TYPES = [
  'Fabric', 'Timber', 'Stone', 'Metal', 'Paint', 'Glass', 'Leather', 'Wallpaper',
  'Laminate', 'Veneer', 'Rattan', 'Marble', 'Ceramic', 'Concrete', 'Other',
]

const EMPTY_SPEC: Omit<StudioSpec, 'id' | 'objectId' | 'slideId'> = {
  specName: '',
  description: '',
  notes: '',
  supplierId: null,
  supplierName: '',
  category: '',
  quantity: '',
  unit: '',
  width: '',
  depth: '',
  height: '',
  materials: [],
  status: 'draft',
  rfqSentAt: null,
  rfqSentTo: [],
  pieceId: null,
  itemSpecs: {},
}

const SPEC_INPUT_CLASS =
  'w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]'
const SPEC_LABEL_CLASS = 'block text-[10px] text-[#8A877F] mb-0.5'

// Specs Engine panel — slides in from the right when an object's Specs are
// opened. Every change autosaves through the store; no Save button, no modal.
export function SpecsPanel() {
  const objectId = useStudioStore(s => s.specPanelObjectId)
  const specs = useStudioStore(s => s.specs)
  const suppliers = useStudioStore(s => s.suppliers)
  const activePriceListIds = useStudioStore(s => s.activePriceListIds)
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const assets = useStudioStore(s => s.assets)
  const assetLabelSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!objectId) return null
  // The panel follows its object — if the object left the current slide
  // (deleted, or slide changed), close quietly. Data is already autosaved.
  const slide = slides.find(sl => sl.id === currentSlideId)
  const obj = slide?.objects.find(o => o.id === objectId)
  if (!obj) return null

  // The image's Asset Library name and this spec's name are the same idea
  // for the same object — kept in lockstep both ways, so they always match
  // exactly. A brand-new spec starts pre-filled from the asset's name;
  // after that, editing either one here pushes the same value onto the
  // asset's label (AssetPanel.tsx does the same back onto any spec that
  // shares that asset's image).
  const matchingAsset = obj.type === 'image' ? assets.find(a => a.url === obj.url) : undefined
  const spec: Omit<StudioSpec, 'id' | 'slideId'> & { id?: string } =
    specs[objectId] ?? { ...EMPTY_SPEC, objectId, specName: matchingAsset?.label ?? '' }

  const update = (patch: Partial<StudioSpec>) =>
    useStudioStore.getState().updateSpec(objectId, patch)

  function setSpecName(name: string) {
    update({ specName: name })
    if (!matchingAsset) return
    const next = name.trim() || null
    if (next === matchingAsset.label) return
    const assetId = matchingAsset.id
    const prevLabel = matchingAsset.label
    useStudioStore.getState().renameAsset(assetId, next)

    // Debounced: TextInput fires this on every keystroke, and un-debounced
    // concurrent writes to the same row can resolve out of order, leaving a
    // stale/partial value as the final saved label even though the UI shows
    // the right one. Only the last keystroke's value actually reaches the DB.
    if (assetLabelSaveTimer.current) clearTimeout(assetLabelSaveTimer.current)
    assetLabelSaveTimer.current = setTimeout(() => {
      const supabase = createClient()
      supabase
        .from('studio_assets')
        .update({ label: next })
        .eq('id', assetId)
        .then(({ error }) => {
          if (error) {
            useStudioStore.getState().renameAsset(assetId, prevLabel)
            toast.error('Could not save name — please try again')
          }
        })
    }, ASSET_LABEL_SYNC_DEBOUNCE)
  }

  function setSupplier(name: string) {
    const match = suppliers.find(su => su.name.toLowerCase() === name.trim().toLowerCase())
    update({ supplierName: name, supplierId: match?.id ?? null })
  }

  function setMaterial(id: string, patch: Partial<MaterialEntry>) {
    update({ materials: spec.materials.map(m => (m.id === id ? { ...m, ...patch } : m)) })
  }

  function setCategory(key: CategoryKey) {
    // Switching category invalidates the old field set — same behaviour as
    // the Pieces catalog editor, so a leftover "leg_height" doesn't silently
    // survive under a category that has no such field.
    update({ category: key, itemSpecs: {} })
  }

  function setItemSpec(key: string, val: string) {
    update({ itemSpecs: { ...spec.itemSpecs, [key]: val } })
  }

  async function refreshFromPiece() {
    if (!spec.pieceId) return
    if (!window.confirm('Replace this spec’s details with the catalog piece’s current data? Any edits made here will be overwritten.')) return
    const supabase = createClient()
    const { data: piece, error } = await supabase
      .from('pieces')
      .select('name, description, category, item_specs, supplier_id, supplier_name, dimensions, colour_finish')
      .eq('id', spec.pieceId)
      .maybeSingle()
    if (error || !piece) {
      toast.error('Could not load piece — it may have been deleted')
      return
    }
    update({
      specName: piece.name ?? spec.specName,
      description: piece.description ?? '',
      category: piece.category ?? 'general',
      itemSpecs: piece.item_specs ?? {},
      supplierId: piece.supplier_id ?? null,
      supplierName: piece.supplier_name ?? '',
    })
    toast.success('Refreshed from catalog')
  }

  function unlinkFromPiece() {
    update({ pieceId: null })
  }

  // The generic Width/Depth/Height block only earns its place when the chosen
  // category doesn't already ask for sizes of its own. It stays visible on a
  // category that does if this spec still holds values there — from before the
  // category was picked, or from an older spec — because those values are
  // still sent to the supplier, and a field nobody can see is worse than a
  // duplicate one.
  const hasGenericDimensions = !!(spec.width.trim() || spec.depth.trim() || spec.height.trim())
  const categoryHasDimensions = categoryCoversDimensions(spec.category)
  const showGenericDimensions = !categoryHasDimensions || hasGenericDimensions

  return (
    <div className="flex-shrink-0 w-[280px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          <ClipboardList size={12} /> Specs
        </span>
        <button
          type="button"
          onClick={() => useStudioStore.getState().openSpecs(null)}
          title="Close"
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Status */}
        <div className="flex rounded-lg border border-[#D8D3C8] overflow-hidden">
          {(['draft', 'approved'] as const).map(sVal => (
            <button
              key={sVal}
              type="button"
              onClick={() => update({ status: sVal })}
              className={`flex-1 py-1.5 text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                spec.status === sVal
                  ? sVal === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#2C2C2A] text-white'
                  : 'bg-white text-[#8A877F] hover:text-[#2C2C2A]'
              }`}
            >
              {sVal}
            </button>
          ))}
        </div>

        {/* Catalog link */}
        {spec.pieceId && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#D8D3C8] bg-white px-2.5 py-2">
            <span className="text-[10px] text-[#8A877F] leading-snug">Linked to catalog piece</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => void refreshFromPiece()}
                title="Refresh from piece"
                className="w-6 h-6 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
              </button>
              <button
                type="button"
                onClick={unlinkFromPiece}
                title="Unlink — make this a one-off variant"
                className="w-6 h-6 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
              >
                <Unlink size={11} />
              </button>
            </div>
          </div>
        )}

        {/* General */}
        <Section title="General">
          <Field label="Spec name">
            <TextInput value={spec.specName} onChange={setSpecName} placeholder="e.g. Lounge armchair" />
          </Field>
          <Field label="Description">
            <TextArea value={spec.description} onChange={v => update({ description: v })} rows={2} />
          </Field>
          <Field label="Notes">
            <TextArea value={spec.notes} onChange={v => update({ notes: v })} rows={2} />
          </Field>
        </Section>

        {/* Category */}
        <Section title="Category">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key as CategoryKey)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors cursor-pointer ${
                  spec.category === cat.key
                    ? 'bg-[#2C2C2A] text-white border-[#2C2C2A]'
                    : 'bg-white text-[#8A877F] border-[#D8D3C8] hover:text-[#2C2C2A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Category-specific specifications */}
        {CATEGORIES.some(c => c.key === spec.category) && spec.category !== 'general' && (
          <Section title="Specifications">
            <CategorySpecFields
              category={spec.category as CategoryKey}
              values={spec.itemSpecs}
              onChange={setItemSpec}
              inputClassName={SPEC_INPUT_CLASS}
              labelClassName={SPEC_LABEL_CLASS}
              fieldWrapperClassName=""
            />
          </Section>
        )}

        {/* Supplier */}
        <Section title="Supplier">
          <Field label="Supplier">
            <TextInput
              value={spec.supplierName}
              onChange={setSupplier}
              placeholder="Choose or type…"
              list="studio-spec-suppliers"
            />
            <datalist id="studio-spec-suppliers">
              {suppliers.map(su => (
                <option key={su.id} value={su.name} />
              ))}
            </datalist>
            {spec.supplierId && (
              <p className="text-[10px] text-emerald-700 mt-1">Linked to existing supplier</p>
            )}
          </Field>
        </Section>

        {/* Quotes received — log what a supplier said, whether that came in
            by email (typed in here) or, later, through a self-serve link.
            If this spec came from a catalog piece, logging a quote here
            also refreshes that piece's reference price — the same way
            accepting a price used to update it, just manual now. */}
        {spec.id && <LoggedQuotes specId={spec.id} pieceId={spec.pieceId} defaultSupplierName={spec.supplierName} />}

        {/* Product */}
        <Section title="Product">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity">
              {/* Number-only: this pulls straight into quote line item quantity */}
              <TextInput
                value={spec.quantity}
                onChange={v => update({ quantity: v.replace(/[^0-9.]/g, '') })}
                placeholder="2"
                inputMode="decimal"
              />
            </Field>
            <Field label="Unit">
              <TextInput value={spec.unit} onChange={v => update({ unit: v })} placeholder="each" />
            </Field>
          </div>
        </Section>

        {/* Dimensions — see showGenericDimensions above */}
        {showGenericDimensions && (
          <Section title="Dimensions">
            {categoryHasDimensions && (
              <p className="text-[10px] text-[#B08968] leading-relaxed mb-1.5">
                This category has its own sizes under Specifications. Clear these so the supplier
                isn&apos;t sent two sets.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Width">
                <TextInput value={spec.width} onChange={v => update({ width: v })} placeholder="mm" />
              </Field>
              <Field label="Depth">
                <TextInput value={spec.depth} onChange={v => update({ depth: v })} placeholder="mm" />
              </Field>
              <Field label="Height">
                <TextInput value={spec.height} onChange={v => update({ height: v })} placeholder="mm" />
              </Field>
            </div>
          </Section>
        )}

        {/* Materials & Finishes */}
        <Section
          title="Materials & Finishes"
          action={
            <button
              type="button"
              onClick={() =>
                update({
                  materials: [
                    ...spec.materials,
                    {
                      id: newId(),
                      type: 'Fabric',
                      description: '',
                      supplierId: null,
                      supplierName: '',
                      twinbruProductId: null,
                      colour: null,
                      imageUrl: null,
                      widthCm: null,
                    },
                  ],
                })
              }
              title="Add material"
              className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
            >
              <Plus size={12} />
            </button>
          }
        >
          {spec.materials.length === 0 ? (
            <p className="text-[11px] text-[#8A877F]">No materials yet — add fabric, timber, stone…</p>
          ) : (
            <div className="space-y-2.5">
              {spec.materials.map(m => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  suppliers={suppliers}
                  activePriceListIds={activePriceListIds}
                  onChange={patch => setMaterial(m.id, patch)}
                  onRemove={() => update({ materials: spec.materials.filter(x => x.id !== m.id) })}
                />
              ))}
            </div>
          )}
          <datalist id="studio-spec-material-types">
            {MATERIAL_TYPES.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Section>
      </div>
    </div>
  )
}

interface SpecQuoteRow {
  id: string
  supplier_name: string
  price: number | null
  notes: string
  lead_time: string
  unable_to_quote: boolean
  source: string
  created_at: string
}

// Record of what a supplier actually quoted — typed in here after reading
// their email reply today; source: 'link' is reserved for a future
// self-serve submission, same table, same list, no separate view to check.
function LoggedQuotes({
  specId,
  pieceId,
  defaultSupplierName,
}: {
  specId: string
  pieceId: string | null
  defaultSupplierName: string
}) {
  const orgId = useStudioStore(s => s.orgId)
  const [quotes, setQuotes] = useState<SpecQuoteRow[] | null>(null)
  const [supplierName, setSupplierNameField] = useState(defaultSupplierName)
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('spec_quotes')
        .select('id, supplier_name, price, notes, lead_time, unable_to_quote, source, created_at')
        .eq('studio_spec_id', specId)
        .order('created_at', { ascending: false })
      if (!cancelled) setQuotes((data ?? []) as SpecQuoteRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [specId])

  async function logQuote() {
    if (!supplierName.trim() || !price.trim()) return
    setSaving(true)
    try {
      // The spec row must exist in the DB before this FK insert can succeed
      await useStudioStore.getState().flushSave()
      const supabase = createClient()
      const { data, error } = await supabase
        .from('spec_quotes')
        .insert({
          org_id: orgId,
          studio_spec_id: specId,
          supplier_name: supplierName.trim(),
          price: Number(price) || null,
          notes: notes.trim(),
          source: 'manual',
        })
        .select('id, supplier_name, price, notes, lead_time, unable_to_quote, source, created_at')
        .single()
      if (error) throw new Error(error.message)
      setQuotes(prev => [data as SpecQuoteRow, ...(prev ?? [])])

      // Piece-sourced spec — refresh the catalog piece's reference price too,
      // so future re-use of it elsewhere starts from an up-to-date number
      if (pieceId) {
        await fetch(`/api/pieces/${pieceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base_price: Number(price) }),
        }).catch(() => {})
      }

      setPrice('')
      setNotes('')
      toast.success('Quote logged')
    } catch (e) {
      toast.error((e as Error).message || 'Could not log quote')
    } finally {
      setSaving(false)
    }
  }

  async function removeQuote(id: string) {
    const prev = quotes
    setQuotes(q => (q ?? []).filter(x => x.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('spec_quotes').delete().eq('id', id)
    if (error) {
      setQuotes(prev ?? null)
      toast.error('Could not remove — please try again')
    }
  }

  return (
    <Section title="Quotes received">
      {quotes === null ? (
        <p className="text-[11px] text-[#8A877F]">Loading…</p>
      ) : quotes.length === 0 ? (
        <p className="text-[11px] text-[#8A877F]">No quotes logged yet</p>
      ) : (
        <div className="space-y-1.5">
          {quotes.map(q => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-1.5 rounded-md border border-[#D8D3C8] bg-white px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-[#2C2C2A] truncate">
                  {q.supplier_name || 'Unnamed supplier'}
                  {q.unable_to_quote
                    ? <span className="text-[#B08968] italic"> — couldn&apos;t quote</span>
                    : q.price != null && <span className="font-medium"> — R{q.price.toLocaleString()}</span>}
                  {q.source === 'link' && (
                    <span className="ml-1 text-[10px] px-1 py-px rounded bg-[#F5EFE4] text-[#9A7B4F] uppercase tracking-wide align-middle" title="Submitted by the supplier via a self-serve link">link</span>
                  )}
                </p>
                {q.lead_time && <p className="text-[10px] text-[#8A877F] mt-0.5 leading-snug">Lead time: {q.lead_time}</p>}
                {q.notes && <p className="text-[10px] text-[#8A877F] mt-0.5 leading-snug">{q.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => void removeQuote(q.id)}
                title="Remove"
                className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 cursor-pointer"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-1.5 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            value={supplierName}
            onChange={e => setSupplierNameField(e.target.value)}
            placeholder="Supplier"
            className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] text-[#2C2C2A]"
          />
          <input
            value={price}
            onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="Price"
            inputMode="decimal"
            className="w-20 text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] text-[#2C2C2A]"
          />
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes — lead time, terms…"
          className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] text-[#2C2C2A]"
        />
        <button
          type="button"
          onClick={() => void logQuote()}
          disabled={saving || !supplierName.trim() || !price.trim()}
          className="w-full flex items-center justify-center gap-1.5 h-7 text-[11px] font-medium bg-[#2C2C2A] text-white rounded-md hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
        >
          <ReceiptText size={11} /> Log quote
        </button>
      </div>
    </Section>
  )
}

// One material/finish entry. Fabric is the one type that can be sourced from
// the platform catalogue — same supplier-dropdown + fabric-search pairing as
// the line items table: pick a supplier, and if it's a platform supplier the
// org has price-list access to, the description box becomes a live fabric
// search. No price is pulled here — convert-to-quote fetches the current
// price when the board is actually turned into a quote.
function MaterialRow({
  material,
  suppliers,
  activePriceListIds,
  onChange,
  onRemove,
}: {
  material: MaterialEntry
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]
  onChange: (patch: Partial<MaterialEntry>) => void
  onRemove: () => void
}) {
  const isFabric = material.type.trim().toLowerCase() === 'fabric'
  const selectedSupplier = isFabric ? suppliers.find(s => s.id === material.supplierId) : undefined
  const platformSupplier = selectedSupplier?.isPlatform ? selectedSupplier : undefined
  const hasAccess = platformSupplier?.priceListId
    ? activePriceListIds.includes(platformSupplier.priceListId)
    : false
  // Platform supplier with access, or an org supplier linked to one of the org's own price lists
  const searchListId = selectedSupplier?.priceListId && (!selectedSupplier.isPlatform || hasAccess)
    ? selectedSupplier.priceListId
    : null

  function handleFabricSelect(fabric: {
    colour: string | null
    brand: string | null
    collection: string | null
    product_id: string | null
    image_url: string | null
    useable_width_cm: number | null
  }) {
    onChange({
      description: [fabric.brand, fabric.collection].filter(Boolean).join(' · '),
      colour: fabric.colour ?? null,
      twinbruProductId: fabric.product_id ? parseInt(fabric.product_id, 10) || null : null,
      imageUrl: fabric.image_url ?? null,
      widthCm: fabric.useable_width_cm ?? null,
    })
  }

  const descriptionInputClass =
    'w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]'

  return (
    <div className="pb-2.5 border-b border-[#EDE9E1] last:border-0 last:pb-0 space-y-1.5">
      <div className="flex items-start gap-1.5">
        <input
          value={material.type}
          onChange={e => onChange({ type: e.target.value })}
          list="studio-spec-material-types"
          placeholder="Type"
          className="w-[88px] flex-shrink-0 text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
        />
        {!isFabric && (
          <input
            value={material.description}
            onChange={e => onChange({ description: e.target.value })}
            placeholder="e.g. Romo Linara Pebble"
            className={`flex-1 min-w-0 ${descriptionInputClass}`}
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {isFabric && (
        <>
          <Combobox
            options={suppliers.map(s => ({ id: s.id, label: s.name, isPlatform: s.isPlatform }))}
            value={material.supplierId ?? ''}
            inputValue={material.supplierName}
            onChange={(id, label) => onChange({ supplierId: id || null, supplierName: label })}
            placeholder="Fabric supplier…"
          />
          {platformSupplier && !hasAccess ? (
            <Link
              href="/price-lists"
              className="block text-[10px] text-amber-600 italic underline hover:text-amber-700"
            >
              Request price list access
            </Link>
          ) : searchListId ? (
            <FabricSearch
              value={material.description}
              onChange={v => onChange({ description: v })}
              onBlur={v => onChange({ description: v })}
              onSelect={handleFabricSelect}
              placeholder="Search fabric…"
              className={descriptionInputClass}
              priceListId={searchListId}
            />
          ) : (
            <input
              value={material.description}
              onChange={e => onChange({ description: e.target.value })}
              placeholder="e.g. Romo Linara Pebble"
              className={descriptionInputClass}
            />
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-[#8A877F] mb-0.5">{label}</span>
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  list,
  inputMode,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  list?: string
  inputMode?: 'decimal'
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      inputMode={inputMode}
      className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
    />
  )
}

function TextArea({
  value,
  onChange,
  rows,
}: {
  value: string
  onChange: (v: string) => void
  rows: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A] resize-y"
    />
  )
}
