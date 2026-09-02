import type { createClient } from '@/lib/supabase/server'
import { normalizeMaterial, type StudioObject, type MaterialEntry } from '@/lib/studio/types'
import { formatCategorySpecs } from '@/lib/specFormatting'

// Shared board → quote row builder. Used by both convert-to-project (first
// time, every spec) and sync-to-project (later, only the specs added to the
// board since). Keeping one builder means both paths produce identical rows —
// same sectioning, dimensions, materials, supplier markups and live fabric
// pricing.

export interface ConvertSpecRow {
  id: string
  object_id: string
  spec_name: string
  description: string
  notes: string
  supplier_id: string | null
  supplier_name: string
  quantity: string
  unit: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  status: string
  category: string
  item_specs: Record<string, string> | null
}

export interface SlideRow {
  id: string
  name: string
  heading: string
  sort_order: number
  objects: StudioObject[]
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

export type LineItemRow = Record<string, unknown>

// Normalise raw studio_specs rows into a Map keyed by object id, so slides can
// look their specs up by the object they annotate.
export function buildSpecByObject(specs: ConvertSpecRow[]): Map<string, ConvertSpecRow> {
  return new Map(
    (specs ?? []).map(s => [
      s.object_id,
      { ...s, materials: (s.materials ?? []).map(normalizeMaterial) },
    ])
  )
}

// Everything a row build needs that has to be fetched: supplier default
// markups, live fabric prices (never stored on the spec — a spec can sit in
// draft for weeks, so price is read at the moment of quoting), and the org's
// default delivery address.
export async function loadPricingContext(
  supabase: SupabaseServer,
  specByObject: Map<string, ConvertSpecRow>
) {
  const supplierIds = [
    ...new Set(
      [...specByObject.values()]
        .flatMap(s => [s.supplier_id, ...s.materials.map(m => m.supplierId)])
        .filter((v): v is string => !!v)
    ),
  ]
  const markupBySupplier = new Map<string, number>()
  if (supplierIds.length) {
    const { data: sups } = await supabase
      .from('suppliers')
      .select('id, markup_percentage')
      .in('id', supplierIds)
    for (const su of sups ?? []) markupBySupplier.set(su.id, su.markup_percentage ?? 0)
  }

  const productIds = [
    ...new Set(
      [...specByObject.values()]
        .flatMap(s => s.materials.map(m => m.twinbruProductId))
        .filter((v): v is number => v != null)
    ),
  ]
  const priceByProductId = new Map<
    string,
    { price: number | null; imageUrl: string | null; widthCm: number | null }
  >()
  if (productIds.length) {
    const { data: items } = await supabase
      .from('price_list_items')
      .select('product_id, price_zar, image_url, useable_width_cm')
      .in('product_id', productIds.map(String))
    for (const it of items ?? []) {
      priceByProductId.set(it.product_id as string, {
        price: (it.price_zar as number | null) ?? null,
        imageUrl: (it.image_url as string | null) ?? null,
        widthCm: (it.useable_width_cm as number | null) ?? null,
      })
    }
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('business_name, business_address')
    .maybeSingle()
  const defaultDeliveryAddress = settings?.business_address
    ? `${settings.business_name ?? ''}\n${settings.business_address}`.trim()
    : ''

  return { markupBySupplier, priceByProductId, defaultDeliveryAddress }
}

// Build rows in deck order: a section per slide (its heading), one item per
// spec beneath it, and each item's materials as indented child rows. Only
// specs whose object still exists on a slide count. Everything lands unpriced
// (cost 0) except fabric materials, which carry a live price. Parents get
// pre-assigned sort_orders; children fill the gaps in a second insert (they
// need parent_item_id, which only exists once the parent row is inserted).
//
// `includeObject` lets sync-to-project restrict the build to just the objects
// that are new to the quote; convert-to-project includes everything.
export function buildBoardRows({
  slides,
  specByObject,
  markupBySupplier,
  priceByProductId,
  defaultDeliveryAddress,
  startSortOrder = 0,
  includeObject = () => true,
}: {
  slides: SlideRow[]
  specByObject: Map<string, ConvertSpecRow>
  markupBySupplier: Map<string, number>
  priceByProductId: Map<string, { price: number | null; imageUrl: string | null; widthCm: number | null }>
  defaultDeliveryAddress: string
  startSortOrder?: number
  includeObject?: (objectId: string) => boolean
}): {
  parents: LineItemRow[]
  parentMeta: { specId: string | null; materials: LineItemRow[] }[]
  itemCount: number
  nextSortOrder: number
} {
  const parents: LineItemRow[] = []
  const parentMeta: { specId: string | null; materials: LineItemRow[] }[] = []
  let itemCount = 0
  let sortOrder = startSortOrder

  slides.forEach((slide, i) => {
    const objects = Array.isArray(slide.objects) ? slide.objects : []
    const specced = objects.filter(o => specByObject.has(o.id) && includeObject(o.id))
    if (!specced.length) return

    parents.push({
      item_name: slide.heading.trim() || slide.name.trim() || `Slide ${i + 1}`,
      description: '',
      quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      // A heading has no delivery address, but the column is NOT NULL and
      // this row is inserted in the same batch as the item rows below —
      // PostgREST widens a bulk insert to the union of every object's keys
      // and fills what's missing with NULL, so omitting it here fails the
      // whole insert rather than falling back to the column default.
      delivery_address: '',
      row_type: 'section',
      indent_level: 0,
      sort_order: sortOrder++,
      studio_slide_id: slide.id,
    })
    parentMeta.push({ specId: null, materials: [] })

    for (const obj of specced) {
      const sp = specByObject.get(obj.id)!
      const genericDimensions = [
        sp.width.trim() && `W ${sp.width.trim()}`,
        sp.depth.trim() && `D ${sp.depth.trim()}`,
        sp.height.trim() && `H ${sp.height.trim()}`,
      ]
        .filter(Boolean)
        .join(' × ')

      const { dimensions: categoryDimensions, colourFinish, extraText } = formatCategorySpecs(
        sp.category,
        sp.item_specs
      )
      const dimensions = categoryDimensions || genericDimensions || null
      const description =
        [sp.description.trim(), sp.notes.trim(), extraText].filter(Boolean).join('\n') || null

      parents.push({
        item_name: sp.spec_name.trim() || 'Untitled item',
        description,
        quantity: parseFloat(sp.quantity) || 1,
        unit: sp.unit.trim() || null,
        supplier_id: sp.supplier_id,
        supplier_name: sp.supplier_name.trim() || null,
        cost_price: 0,
        markup_percentage: sp.supplier_id ? (markupBySupplier.get(sp.supplier_id) ?? 0) : 0,
        dimensions,
        colour_finish: colourFinish,
        delivery_address: defaultDeliveryAddress,
        row_type: 'item',
        indent_level: 0,
        sort_order: sortOrder++,
        studio_slide_id: slide.id,
        studio_object_id: obj.id,
      })
      itemCount++

      const materials = (Array.isArray(sp.materials) ? sp.materials : []).map(m => {
        const live = m.twinbruProductId != null ? priceByProductId.get(String(m.twinbruProductId)) : undefined
        // The material's TYPE names the row ("Fabric", "Timber") and the
        // specifics go in the description, which is the column that wraps —
        // packing both into item_name truncated long collection names against
        // an empty description sitting right beside them. A material with no
        // type falls back to its description for the name so no row is
        // nameless, and then has nothing left to repeat in the description.
        const mType = m.type.trim()
        const mDesc = m.description.trim()
        return {
          item_name: mType || mDesc || 'Material',
          description: (mType ? mDesc : '') || null,
          quantity: 1,
          unit: m.twinbruProductId != null ? 'm' : null,
          supplier_id: m.supplierId,
          supplier_name: m.supplierName.trim() || null,
          cost_price: live?.price ?? 0,
          markup_percentage: m.supplierId ? (markupBySupplier.get(m.supplierId) ?? 0) : 0,
          colour_finish: m.colour,
          fabric_image_url: live?.imageUrl ?? m.imageUrl,
          twinbru_product_id: m.twinbruProductId,
          twinbru_cost_price: live?.price ?? null,
          fabric_width_cm: live?.widthCm ?? m.widthCm,
          delivery_address: defaultDeliveryAddress,
          row_type: 'item',
          indent_level: 1,
          sort_order: sortOrder++,
          studio_slide_id: slide.id,
          studio_object_id: obj.id,
        }
      })
      parentMeta.push({ specId: sp.id, materials })
    }
  })

  return { parents, parentMeta, itemCount, nextSortOrder: sortOrder }
}
