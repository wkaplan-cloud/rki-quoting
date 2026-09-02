'use client'
import Link from 'next/link'
import { useRef } from 'react'
import { X, Plus, Trash2, ClipboardList, RefreshCw, Unlink } from 'lucide-react'
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

        {/* Item — what it is and how many. The fields every line item and
            every RFQ needs, so they lead the panel; everything below is
            detail that refines them. */}
        <Section title="Item">
          <Field label="Spec name">
            <TextInput value={spec.specName} onChange={setSpecName} />
          </Field>
          <Field label="Description">
            <TextArea value={spec.description} onChange={v => update({ description: v })} rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity">
              {/* Number-only: this pulls straight into quote line item quantity */}
              <TextInput
                value={spec.quantity}
                onChange={v => update({ quantity: v.replace(/[^0-9.]/g, '') })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Unit">
              <TextInput value={spec.unit} onChange={v => update({ unit: v })} />
            </Field>
          </div>
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
              <Field label="Width (mm)">
                <TextInput value={spec.width} onChange={v => update({ width: v })} />
              </Field>
              <Field label="Depth (mm)">
                <TextInput value={spec.depth} onChange={v => update({ depth: v })} />
              </Field>
              <Field label="Height (mm)">
                <TextInput value={spec.height} onChange={v => update({ height: v })} />
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

        {/* Supplier — last, because it's the one decision that follows from
            everything above: what it is, then who's being asked to price it */}
        <Section title="Supplier">
          <Field label="Supplier">
            <TextInput
              value={spec.supplierName}
              onChange={setSupplier}
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
      </div>
    </div>
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
      <div className="flex items-end gap-1.5">
        <Field label="Type" className="w-[88px] flex-shrink-0">
          <input
            value={material.type}
            onChange={e => onChange({ type: e.target.value })}
            list="studio-spec-material-types"
            className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
        </Field>
        {!isFabric && (
          <Field label="Description" className="flex-1 min-w-0">
            <input
              value={material.description}
              onChange={e => onChange({ description: e.target.value })}
              className={descriptionInputClass}
            />
          </Field>
        )}
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="w-6 h-6 mb-0.5 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {isFabric && (
        <>
          <Field label="Fabric supplier">
            <Combobox
              options={suppliers.map(s => ({ id: s.id, label: s.name, isPlatform: s.isPlatform }))}
              value={material.supplierId ?? ''}
              inputValue={material.supplierName}
              onChange={(id, label) => onChange({ supplierId: id || null, supplierName: label })}
            />
          </Field>
          {platformSupplier && !hasAccess ? (
            <Link
              href="/price-lists"
              className="block text-[10px] text-amber-600 italic underline hover:text-amber-700"
            >
              Request price list access
            </Link>
          ) : searchListId ? (
            <Field label="Fabric">
              <FabricSearch
                value={material.description}
                onChange={v => onChange({ description: v })}
                onBlur={v => onChange({ description: v })}
                onSelect={handleFabricSelect}
                className={descriptionInputClass}
                priceListId={searchListId}
              />
            </Field>
          ) : (
            <Field label="Fabric">
              <input
                value={material.description}
                onChange={e => onChange({ description: e.target.value })}
                className={descriptionInputClass}
              />
            </Field>
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

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] text-[#8A877F] mb-0.5">{label}</span>
      {children}
    </label>
  )
}

// No placeholder prop by design: every field in this panel carries a visible
// label, and greyed example text inside an empty box reads as a value that is
// already filled in.
function TextInput({
  value,
  onChange,
  list,
  inputMode,
}: {
  value: string
  onChange: (v: string) => void
  list?: string
  inputMode?: 'decimal'
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
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
