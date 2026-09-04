'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { X, Plus, Trash2, ClipboardList, RefreshCw, Unlink, Upload, Images, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore, newId } from '@/lib/studio/store'
import { createClient } from '@/lib/supabase/client'
import { uploadSpecImageFile } from '@/lib/studio/images'
import type {
  StudioSpec,
  MaterialEntry,
  ScatterEntry,
  SpecImage,
  SpecSupplierOption,
  StudioAsset,
  ImageObject,
} from '@/lib/studio/types'
import { Combobox } from '@/components/ui/Combobox'
import { FabricSearch } from '@/components/ui/FabricSearch'
import { CroppedImage } from '@/components/shared/CroppedImage'
import { CategorySpecFields } from '@/components/shared/CategorySpecFields'
import { SpecAssetPickerModal } from '@/components/studio/SpecAssetPickerModal'
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
  scatters: [],
  images: [],
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

  function setScatter(id: string, patch: Partial<ScatterEntry>) {
    update({ scatters: spec.scatters.map(sc => (sc.id === id ? { ...sc, ...patch } : sc)) })
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

        {/* Images — the pictures that travel with this item to the supplier.
            First in the panel because a supplier reads the photos before a
            single field: the board image (cropped exactly as framed on the
            slide) plus any extra views added here. */}
        <SpecImagesSection
          object={obj.type === 'image' ? obj : null}
          images={spec.images}
          assets={assets}
          onChange={next => update({ images: next })}
        />

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

        {/* Supplier — the maker of the piece itself, above the materials
            because every material and scatter row carries its own supplier
            underneath: pick who's building it before who's supplying its
            fabric, and the two never get confused. */}
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
                      quantity: '',
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

        {/* Scatters — their own section, not a material: a scatter is a
            separate quotable thing with its own supplier, fabric, size and
            quantity. The sofa maker rarely makes the scatters. */}
        <Section
          title="Scatters"
          action={
            <button
              type="button"
              onClick={() =>
                update({
                  scatters: [
                    ...spec.scatters,
                    {
                      id: newId(),
                      supplierId: null,
                      supplierName: '',
                      fabricSupplierId: null,
                      fabricSupplierName: '',
                      fabricQuantity: '',
                      fabric: '',
                      twinbruProductId: null,
                      colour: null,
                      imageUrl: null,
                      widthCm: null,
                      size: '',
                      quantity: '',
                      details: '',
                    },
                  ],
                })
              }
              title="Add scatter"
              className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
            >
              <Plus size={12} />
            </button>
          }
        >
          {spec.scatters.length === 0 ? (
            <p className="text-[11px] text-[#8A877F]">No scatters yet — add one per size or fabric.</p>
          ) : (
            <div className="space-y-2.5">
              {spec.scatters.map(sc => (
                <ScatterRow
                  key={sc.id}
                  scatter={sc}
                  suppliers={suppliers}
                  activePriceListIds={activePriceListIds}
                  onChange={patch => setScatter(sc.id, patch)}
                  onRemove={() => update({ scatters: spec.scatters.filter(x => x.id !== sc.id) })}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

// Which price list a supplier's fabric search should read, if any. Platform
// suppliers need the org to actually hold access to their list; an org's own
// supplier just needs a list attached. Shared by materials and scatters — both
// pair a supplier dropdown with a fabric search exactly like the line items
// table does.
function fabricSearchContext(
  supplierId: string | null,
  suppliers: SpecSupplierOption[],
  activePriceListIds: string[]
) {
  const selected = suppliers.find(su => su.id === supplierId)
  const platformSupplier = selected?.isPlatform ? selected : undefined
  const hasAccess = platformSupplier?.priceListId
    ? activePriceListIds.includes(platformSupplier.priceListId)
    : false
  const searchListId =
    selected?.priceListId && (!selected.isPlatform || hasAccess) ? selected.priceListId : null
  return { platformSupplier, hasAccess, searchListId }
}

const FIELD_INPUT_CLASS =
  'w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]'

// Selected fabric fields shared by MaterialEntry and ScatterEntry
interface FabricPick {
  colour: string | null
  brand: string | null
  collection: string | null
  product_id: string | null
  image_url: string | null
  useable_width_cm: number | null
}

function fabricPatch(fabric: FabricPick) {
  return {
    colour: fabric.colour ?? null,
    twinbruProductId: fabric.product_id ? parseInt(fabric.product_id, 10) || null : null,
    imageUrl: fabric.image_url ?? null,
    widthCm: fabric.useable_width_cm ?? null,
  }
}

function fabricLabel(fabric: FabricPick) {
  return [fabric.brand, fabric.collection].filter(Boolean).join(' · ')
}

// The supplier + fabric-search pair. Shown for a fabric material and for every
// scatter; the search only turns on when the chosen supplier has a price list
// this org can read, otherwise the field stays plain free text.
function SupplierFabricFields({
  label,
  supplierId,
  supplierName,
  fabric,
  quantity,
  quantityLabel = 'Metres to order',
  suppliers,
  activePriceListIds,
  onChange,
}: {
  label: string
  supplierId: string | null
  supplierName: string
  fabric: string
  quantity: string
  quantityLabel?: string
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]
  onChange: (patch: {
    supplierId?: string | null
    supplierName?: string
    fabric?: string
    quantity?: string
    colour?: string | null
    twinbruProductId?: number | null
    imageUrl?: string | null
    widthCm?: number | null
  }) => void
}) {
  const { platformSupplier, hasAccess, searchListId } = fabricSearchContext(
    supplierId,
    suppliers,
    activePriceListIds
  )
  return (
    <>
      <Field label={label}>
        <Combobox
          options={suppliers.map(su => ({ id: su.id, label: su.name, isPlatform: su.isPlatform }))}
          value={supplierId ?? ''}
          inputValue={supplierName}
          onChange={(id, name) => onChange({ supplierId: id || null, supplierName: name })}
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
            value={fabric}
            onChange={v => onChange({ fabric: v })}
            onBlur={v => onChange({ fabric: v })}
            onSelect={f => onChange({ fabric: fabricLabel(f), ...fabricPatch(f) })}
            className={FIELD_INPUT_CLASS}
            priceListId={searchListId}
          />
        </Field>
      ) : (
        <Field label="Fabric">
          <input
            value={fabric}
            onChange={e => onChange({ fabric: e.target.value })}
            className={FIELD_INPUT_CLASS}
          />
        </Field>
      )}
      {/* The fabric is bought from the house above on its own order, so the
          yardage is specified here — it becomes that line's quantity on the
          quote instead of a default 1 somebody has to correct later. */}
      <Field label={quantityLabel}>
        <input
          value={quantity}
          onChange={e => onChange({ quantity: e.target.value.replace(/[^0-9.]/g, '') })}
          inputMode="decimal"
          className={FIELD_INPUT_CLASS}
        />
      </Field>
    </>
  )
}

// One material/finish entry. EVERY type carries its own supplier — the timber,
// the stone and the fabric on a single piece routinely come from three
// different places, and each has to be priced by whoever actually supplies it.
// Fabric additionally gets the platform catalogue search (same supplier-dropdown
// + fabric-search pairing as the line items table). No price is pulled here —
// convert-to-quote fetches the current price when the board becomes a quote.
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

  return (
    <div className="pb-2.5 border-b border-[#EDE9E1] last:border-0 last:pb-0 space-y-1.5">
      <div className="flex items-end gap-1.5">
        <Field label="Type" className="flex-1 min-w-0">
          <input
            value={material.type}
            onChange={e => onChange({ type: e.target.value })}
            list="studio-spec-material-types"
            className={FIELD_INPUT_CLASS}
          />
        </Field>
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="w-6 h-6 mb-0.5 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {isFabric ? (
        <SupplierFabricFields
          label="Fabric supplier"
          supplierId={material.supplierId}
          supplierName={material.supplierName}
          fabric={material.description}
          quantity={material.quantity}
          suppliers={suppliers}
          activePriceListIds={activePriceListIds}
          onChange={patch => {
            const { fabric, ...rest } = patch
            onChange({ ...rest, ...(fabric !== undefined ? { description: fabric } : {}) })
          }}
        />
      ) : (
        <>
          <Field label="Supplier">
            <Combobox
              options={suppliers.map(su => ({ id: su.id, label: su.name, isPlatform: su.isPlatform }))}
              value={material.supplierId ?? ''}
              inputValue={material.supplierName}
              onChange={(id, name) => onChange({ supplierId: id || null, supplierName: name })}
            />
          </Field>
          <Field label="Description">
            <input
              value={material.description}
              onChange={e => onChange({ description: e.target.value })}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label="Quantity to order">
            <input
              value={material.quantity}
              onChange={e => onChange({ quantity: e.target.value.replace(/[^0-9.]/g, '') })}
              inputMode="decimal"
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </>
      )}
    </div>
  )
}

// One scatter cushion line: who makes it, what it's covered in, how big, how
// many, and anything else the maker needs (piping, fill, back fabric…).
function ScatterRow({
  scatter,
  suppliers,
  activePriceListIds,
  onChange,
  onRemove,
}: {
  scatter: ScatterEntry
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]
  onChange: (patch: Partial<ScatterEntry>) => void
  onRemove: () => void
}) {
  return (
    <div className="pb-2.5 border-b border-[#EDE9E1] last:border-0 last:pb-0 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8A877F]">Scatter</span>
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-[#EDE9E1] transition-colors cursor-pointer"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Who makes it, then who supplies its fabric — two different
          businesses on most scatters, so they get two fields. The fabric
          search below reads the FABRIC house's price list, not the maker's. */}
      <Field label="Scatter supplier">
        <Combobox
          options={suppliers.map(su => ({ id: su.id, label: su.name, isPlatform: su.isPlatform }))}
          value={scatter.supplierId ?? ''}
          inputValue={scatter.supplierName}
          onChange={(id, name) => onChange({ supplierId: id || null, supplierName: name })}
        />
      </Field>

      <SupplierFabricFields
        label="Fabric house"
        supplierId={scatter.fabricSupplierId}
        supplierName={scatter.fabricSupplierName}
        fabric={scatter.fabric}
        quantity={scatter.fabricQuantity}
        suppliers={suppliers}
        activePriceListIds={activePriceListIds}
        onChange={({ supplierId, supplierName, quantity, ...rest }) =>
          onChange({
            ...rest,
            ...(supplierId !== undefined ? { fabricSupplierId: supplierId } : {}),
            ...(supplierName !== undefined ? { fabricSupplierName: supplierName } : {}),
            // `quantity` on a scatter is how many cushions — the fabric's
            // yardage is its own field, so it must never land on that one
            ...(quantity !== undefined ? { fabricQuantity: quantity } : {}),
          })
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Size (mm)">
          <input
            value={scatter.size}
            onChange={e => onChange({ size: e.target.value })}
            className={FIELD_INPUT_CLASS}
          />
        </Field>
        <Field label="Quantity">
          <input
            value={scatter.quantity}
            onChange={e => onChange({ quantity: e.target.value.replace(/[^0-9.]/g, '') })}
            inputMode="decimal"
            className={FIELD_INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="Details">
        <textarea
          value={scatter.details}
          onChange={e => onChange({ details: e.target.value })}
          rows={2}
          className={`${FIELD_INPUT_CLASS} resize-y`}
        />
      </Field>
    </div>
  )
}

// Extra images for this item. The board image itself is shown first and is not
// editable here — it is whatever sits on the slide, cropped as framed there —
// followed by any additional views pulled from the board's asset library or
// uploaded fresh. These never appear on the moodboard; they exist so a supplier
// pricing a custom piece can see the back, the joint, the drawing.
function SpecImagesSection({
  object,
  images,
  assets,
  onChange,
}: {
  object: ImageObject | null
  images: SpecImage[]
  assets: StudioAsset[]
  onChange: (next: SpecImage[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const usedUrls = new Set(images.map(i => i.url))

  function addAssets(chosen: StudioAsset[]) {
    const added = chosen
      .filter(a => !usedUrls.has(a.url))
      .map(a => ({
        id: newId(),
        url: a.url,
        naturalWidth: a.naturalWidth,
        naturalHeight: a.naturalHeight,
        caption: a.label ?? '',
      }))
    if (added.length) onChange([...images, ...added])
    setPicking(false)
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: SpecImage[] = []
      for (const file of Array.from(files)) {
        const up = await uploadSpecImageFile(file)
        added.push({
          id: newId(),
          url: up.url,
          naturalWidth: up.width,
          naturalHeight: up.height,
          caption: '',
        })
      }
      onChange([...images, ...added])
    } catch (e) {
      toast.error((e as Error).message || 'Could not add image')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Section title="Images">
      <div className="grid grid-cols-3 gap-1.5">
        {object && (
          <div className="flex flex-col gap-0.5">
            <CroppedImage
              src={object.url}
              alt="Board image"
              crop={object.crop}
              naturalWidth={object.naturalWidth}
              naturalHeight={object.naturalHeight}
              crossOrigin="anonymous"
              className="aspect-square w-full rounded-md border border-[#9A7B4F] bg-white"
            />
            <span className="text-[9px] text-[#8A877F] leading-tight">On board</span>
          </div>
        )}
        {images.map(img => (
          <div key={img.id} className="group relative flex flex-col gap-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption || 'Item image'}
              crossOrigin="anonymous"
              className="aspect-square w-full rounded-md border border-[#D8D3C8] bg-white object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(images.filter(x => x.id !== img.id))}
              title="Remove this image"
              className="absolute top-1 right-1 w-5 h-5 hidden group-hover:flex items-center justify-center rounded bg-white/90 text-[#8A877F] hover:text-red-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
            >
              <Trash2 size={10} />
            </button>
            <span className="text-[9px] text-[#8A877F] leading-tight truncate">
              {img.caption || 'Extra view'}
            </span>
          </div>
        ))}
      </div>

      {object?.crop && (
        <p className="text-[10px] text-[#8A877F] leading-relaxed">
          The board image is cropped — suppliers are sent this cropped view.
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md border border-[#D8D3C8] bg-white text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors cursor-pointer"
        >
          <Images size={11} /> Assets
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md border border-[#D8D3C8] bg-white text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={e => void upload(e.target.files)}
          className="hidden"
          aria-label="Upload more images of this item"
        />
      </div>

      {picking && (
        <SpecAssetPickerModal
          assets={assets}
          usedUrls={usedUrls}
          onAdd={addAssets}
          onClose={() => setPicking(false)}
        />
      )}
    </Section>
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
