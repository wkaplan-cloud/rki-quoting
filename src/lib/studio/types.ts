// Studio module object model.
// All coordinates are in page points — a fixed A3 landscape space of PAGE_W × PAGE_H
// (see constants.ts). Z-order is the index in StudioSlide.objects (first = back).

export interface StudioObjectBase {
  id: string
  x: number
  y: number
  rotation: number // degrees, around the object's top-left origin
  opacity: number // 0–1
  locked: boolean
}

export interface ImageObject extends StudioObjectBase {
  type: 'image'
  url: string
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  // Crop rect in SOURCE pixels — maps 1:1 to Konva.Image's `crop` prop
  crop?: { x: number; y: number; width: number; height: number }
  borderColor?: string
  borderWidth?: number
  // Background removal (Phase 5). `url` always points at the ACTIVE variant;
  // both variants are kept so the user can toggle freely without reprocessing.
  // The processed file has the same pixel dimensions as the original, so
  // crop/naturalWidth/naturalHeight stay valid for both.
  originalUrl?: string // pre-removal image, set on first successful removal
  processedUrl?: string // transparent-background result (cached)
}

export interface TextObject extends StudioObjectBase {
  type: 'text'
  text: string
  width: number // wrap width; height is auto
  fontSize: number
  fontFamily: string
  // Per-object font choice (textFonts.ts id). Undefined = follow the
  // board-wide content font, which keeps old boards rendering unchanged.
  fontId?: string
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic'
  textDecoration: '' | 'underline'
  fill: string
  align: 'left' | 'center' | 'right'
  lineHeight?: number // multiplier; undefined = 1.3 (pre-existing boards)
}

export interface RectObject extends StudioObjectBase {
  type: 'rect'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export interface EllipseObject extends StudioObjectBase {
  type: 'ellipse'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineObject extends StudioObjectBase {
  type: 'line' | 'arrow'
  // Endpoint coordinates relative to (x, y)
  points: [number, number, number, number]
  stroke: string
  strokeWidth: number
}

// An ✕ mark spanning its width × height box — two crossing strokes
export interface CrossObject extends StudioObjectBase {
  type: 'cross'
  width: number
  height: number
  stroke: string
  strokeWidth: number
}

export type StudioObject = ImageObject | TextObject | RectObject | EllipseObject | LineObject | CrossObject

export interface StudioSlide {
  id: string
  name: string
  heading: string
  sortOrder: number
  objects: StudioObject[]
  // The board's title slide — logo/client name/project detail are composed
  // as ordinary objects, so the editor skips the standard master layout
  // (heading/title/page number/corner logo) here to avoid a visual clash.
  isCover: boolean
}

/**
 * What a board remembers between visits: the slide you were on, and nothing
 * else. Zoom and pan used to be stored here too, and reopening a board dropped
 * you back at whatever magnification you happened to leave it at — mid-detail
 * on one corner of a slide, with no sense of the page. A board now always
 * opens fit to the page. Rows written before this still carry the old zoom
 * and pan keys; they are simply ignored.
 */
export interface BoardLastState {
  slideId: string | null
}

// Every image imported into a board is registered as an asset (deduplicated
// by content hash). `label` is a designer-chosen name (e.g. "Sofa", "Oak
// wood") — optional, picked from a dropdown of names already used across the
// org where possible, powering the cross-board asset search.
export interface StudioAsset {
  id: string
  url: string
  hash: string
  naturalWidth: number
  naturalHeight: number
  fileSize: number
  createdAt: string
  label: string | null
}

export interface StudioAssetRow {
  id: string
  board_id: string
  org_id: string
  url: string
  hash: string
  natural_width: number
  natural_height: number
  file_size: number
  created_at: string
  label?: string | null
}

export function assetFromRow(row: StudioAssetRow): StudioAsset {
  return {
    id: row.id,
    url: row.url,
    hash: row.hash,
    naturalWidth: row.natural_width,
    naturalHeight: row.natural_height,
    fileSize: row.file_size,
    createdAt: row.created_at,
    label: row.label ?? null,
  }
}

// ── Specs Engine ────────────────────────────────────────────────────────────
// One spec per canvas object (keyed by object id). Future phases connect
// specs to quote line items and a product library via lineItemId/productId.

export interface MaterialEntry {
  id: string
  type: string // Fabric, Timber, Stone, Metal, Paint, Glass, Leather, Wallpaper…
  description: string
  // The supplier chosen for THIS material — every type, not just fabric, since
  // the timber, the stone and the fabric on one piece routinely come from three
  // different places and each has to be priced by its own supplier. Fabric
  // additionally carries the platform catalogue's product identity. Deliberately
  // no price here — the convert-to-quote step looks up the CURRENT price at that
  // moment, so a spec drafted weeks earlier never quotes a stale number.
  supplierId: string | null
  supplierName: string
  // How much to order from that supplier — metres of fabric, litres of paint,
  // sheets of veneer. The designer allocates it here so the material's own
  // line on the quote is orderable as it stands, rather than defaulting to 1
  // and being fixed up by hand later.
  quantity: string
  twinbruProductId: number | null
  colour: string | null
  imageUrl: string | null
  widthCm: number | null
  // A single piece routinely takes more than one fabric — a couch in a body
  // cloth with a contrast inside back. The fields above are the FIRST fabric;
  // any further ones live here, each with its own house and yardage so each
  // is ordered on its own line. Fabric materials only.
  extraFabrics: FabricLine[]
  // Free text saying where each fabric goes ("velvet on the outside back").
  // Deliberately one note for the material rather than a label per fabric —
  // the designer describes the whole piece in one place.
  details: string
}

// Materials saved before the fabric-supplier fields existed are missing them
// in the stored JSON — default them so old boards render without crashing.
export function normalizeMaterial(m: Partial<MaterialEntry> & { id: string; type: string; description: string }): MaterialEntry {
  return {
    id: m.id,
    type: m.type,
    description: m.description,
    supplierId: m.supplierId ?? null,
    supplierName: m.supplierName ?? '',
    quantity: m.quantity ?? '',
    twinbruProductId: m.twinbruProductId ?? null,
    colour: m.colour ?? null,
    imageUrl: m.imageUrl ?? null,
    widthCm: m.widthCm ?? null,
    extraFabrics: Array.isArray(m.extraFabrics)
      ? m.extraFabrics.map((f, i) => normalizeFabricLine({ ...f, id: f.id ?? `${m.id}-f${i + 1}` }))
      : [],
    details: m.details ?? '',
  }
}

// One fabric, wherever it is used. A scatter is routinely covered in more
// than one — a face, a different back, a contrast piping — and so is a couch.
// Each is bought in its own yardage, often from a different house, and each is
// quoted and ordered on its own line, so each is its own entry. Where the
// fabric actually goes is written in the owning item's Details note, not
// labelled per line.
export interface FabricLine {
  id: string
  // Who supplies this fabric. Separate from the piece's maker: a scatter is
  // routinely made by one workroom in fabric bought from another house, and it
  // is this supplier's price list the fabric search reads.
  fabricSupplierId: string | null
  fabricSupplierName: string
  // Metres to order from that house for this fabric — it is quoted and ordered
  // on its own line, so the designer allocates the yardage here rather than
  // leaving it to be worked out at ordering time.
  fabricQuantity: string
  // Fabric: free text, or a platform-catalogue pick (same flow as MaterialEntry)
  fabric: string
  twinbruProductId: number | null
  colour: string | null
  imageUrl: string | null
  widthCm: number | null
}

// The pre-multi-fabric shape: one fabric flattened onto the scatter itself.
// Every scatter saved before multi-fabric still carries these, so reads fold
// them into fabrics[0] rather than migrating the stored JSON.
interface LegacyScatterFabricFields {
  fabricSupplierId?: string | null
  fabricSupplierName?: string
  fabricQuantity?: string
  fabric?: string
  twinbruProductId?: number | null
  colour?: string | null
  imageUrl?: string | null
  widthCm?: number | null
}

export function normalizeFabricLine(f: Partial<FabricLine> & { id: string }): FabricLine {
  return {
    id: f.id,
    fabricSupplierId: f.fabricSupplierId ?? null,
    fabricSupplierName: f.fabricSupplierName ?? '',
    fabricQuantity: f.fabricQuantity ?? '',
    fabric: f.fabric ?? '',
    twinbruProductId: f.twinbruProductId ?? null,
    colour: f.colour ?? null,
    imageUrl: f.imageUrl ?? null,
    widthCm: f.widthCm ?? null,
  }
}

export function emptyFabricLine(id: string): FabricLine {
  return normalizeFabricLine({ id })
}

// Scatter cushions specified against a piece. Kept separate from materials
// because a scatter is its own quotable thing: it has its own supplier (the
// scatters on a sofa are routinely made by someone other than the sofa maker),
// its own fabrics, size and quantity. Same no-price rule as MaterialEntry —
// fabric pricing is looked up live at convert-to-quote time.
export interface ScatterEntry {
  id: string
  // Who makes the scatter — the cushion maker, not the fabric house
  supplierId: string | null
  supplierName: string
  // One or more fabrics, each with its own house and yardage. fabrics[0] is
  // the scatter's main fabric; any beyond it were added under Details.
  fabrics: FabricLine[]
  size: string // e.g. "600 × 600" — free text, scatters are quoted by nominal size
  quantity: string
  details: string
}

export function normalizeScatter(
  sc: Partial<ScatterEntry> & LegacyScatterFabricFields & { id: string }
): ScatterEntry {
  const stored = Array.isArray(sc.fabrics) ? sc.fabrics : []
  // A legacy scatter has no fabrics array at all — its single fabric sat flat
  // on the scatter. Fold it into fabrics[0]. Every scatter keeps at least one
  // fabric slot so the main row always has something to render into.
  const fabrics = stored.length
    ? stored.map((f, i) => normalizeFabricLine({ ...f, id: f.id ?? `${sc.id}-f${i}` }))
    : [normalizeFabricLine({ ...sc, id: `${sc.id}-f0` })]
  return {
    id: sc.id,
    supplierId: sc.supplierId ?? null,
    supplierName: sc.supplierName ?? '',
    fabrics,
    size: sc.size ?? '',
    quantity: sc.quantity ?? '',
    details: sc.details ?? '',
  }
}

// ── Who is asked what ───────────────────────────────────────────────────────
// A spec is written as one item, but it is bought from several people. A sofa
// is built by an upholsterer, its scatters are sewn by a cushion workroom, its
// marble top is cut by a stone yard — and each of those is named on the spec
// against the part they supply. So a quote request is never the whole spec: it
// is the slice of it one supplier is responsible for.
//
// Two kinds of thing get asked for:
//
//   A COMPONENT is priced by its own supplier — a scatter, a stone top. They
//   quote it, say how many they are making, and measure whatever cloth it
//   takes. It never appears on anyone else's sheet.
//
//   A MATERIAL QUANTITY is measured but not priced by the person answering.
//   Cloth is the case: the linen comes from Hertex at Hertex's price, but only
//   the upholsterer knows how many metres the piece eats. So these ride along
//   with whoever is making the thing they go on.
//
// Timber, metal, paint and glass are asked for at all — they are quoted into
// the maker's own price rather than bought by measure against this spec.

/**
 * Cloth: bought by the metre from a house, measured by whoever makes the thing
 * it covers. Never priced by them.
 */
const MAKER_MEASURED_TYPES = new Set(['fabric', 'leather'])

/**
 * Stone: cut, fabricated, measured and priced by its own yard, off the
 * drawing. A component in its own right, not a cloth on somebody else's piece.
 */
const SUPPLIER_PRICED_TYPES = new Set(['stone'])

export function isQuantityMaterial(type: string): boolean {
  const t = type.trim().toLowerCase()
  return MAKER_MEASURED_TYPES.has(t) || SUPPLIER_PRICED_TYPES.has(t)
}

/** True for a material the supplier named on it prices, rather than measures. */
export function isSupplierPricedMaterial(type: string): boolean {
  return SUPPLIER_PRICED_TYPES.has(type.trim().toLowerCase())
}

/** How a material is sold: cloth by the running metre, stone by area. */
export function materialQuantityUnit(type: string): QuantityUnit {
  return isSupplierPricedMaterial(type) ? 'm²' : 'm'
}

export type QuantityUnit = 'm' | 'm²'

/**
 * The key that ties one line on a supplier's sheet to its own line on the
 * quote, all the way from the spec through the form to the child line item.
 * Stable by construction: every part is an id already stored on the spec, so
 * it survives renaming a fabric, swapping its house or reordering the list.
 */
export const materialQuantityKey = {
  material: (materialId: string) => `m:${materialId}`,
  extraFabric: (materialId: string, fabricId: string) => `m:${materialId}:f:${fabricId}`,
  scatter: (scatterId: string) => `sc:${scatterId}`,
  scatterFabric: (scatterId: string, fabricId: string) => `sc:${scatterId}:f:${fabricId}`,
}

/** Who supplies a thing, as named on the spec. */
export interface SupplierRef {
  supplierId: string | null
  supplierName: string
}

/** Matched on id where both sides have one, on name otherwise — either side
 *  can be a name typed into the send modal that was never linked to a record. */
export function sameSupplier(a: SupplierRef, b: SupplierRef): boolean {
  if (a.supplierId && b.supplierId) return a.supplierId === b.supplierId
  const an = a.supplierName.trim().toLowerCase()
  const bn = b.supplierName.trim().toLowerCase()
  return !!an && an === bn
}

/** Nobody named against it — it falls to whoever makes the item. */
const unassigned = (ref: SupplierRef) => !ref.supplierId && !ref.supplierName.trim()

/** One box asking how much of a material the piece takes. Never a price. */
export interface MaterialQuantityAsk {
  key: string
  /** What is being measured — "Fabric · Linen Natural". */
  label: string
  /** The house it comes from, shown so the maker prices make-up, not cloth. */
  supplierName: string
  /** Metres for cloth, square metres for stone. */
  unit: QuantityUnit
  /** What the designer allocated, if anything. Usually blank. */
  designerQuantity: string
}

/**
 * One thing this supplier makes, prices and counts — a scatter, a stone top.
 * Its own cloth hangs beneath it, because the person sewing the cushion is the
 * one who knows how much velvet it takes.
 */
export interface ComponentAsk {
  key: string
  /** "Scatter 600 × 600" / "Stone · Nero Marquina top". */
  label: string
  /** Free text off the spec — where it goes, what is in it. */
  details: string
  /**
   * What one of them is. 'each' counts them (four cushions), an area unit
   * measures them (2,4 m² of marble) — so the price box reads "price each" or
   * "price per m²" accordingly.
   */
  unit: 'each' | QuantityUnit
  /** The count or area the designer put down, if any. Either side may fill it. */
  designerQuantity: string
  /** Cloth on this component, measured by whoever makes it. */
  materials: MaterialQuantityAsk[]
}

/**
 * Everything one recipient is asked about on one spec.
 *
 * `ownsItem` is what separates the two kinds of sheet. The item's maker gets
 * the piece itself — its specs, its dimensions, its cloth — and a price for
 * it. A component supplier gets the picture, the name, and nothing but their
 * own part: they are not quoting the sofa, and a sheet full of somebody else's
 * spec only invites them to price it.
 */
export interface SpecSheet {
  ownsItem: boolean
  /** Cloth on the item itself. Empty unless `ownsItem`. */
  itemMaterials: MaterialQuantityAsk[]
  /** Components this recipient makes. */
  components: ComponentAsk[]
}

/** Everything anyone could be asked on this spec, before it is narrowed. */
function allComponents(
  materials: MaterialEntry[],
  scatters: ScatterEntry[]
): { owner: SupplierRef; ask: ComponentAsk }[] {
  const out: { owner: SupplierRef; ask: ComponentAsk }[] = []

  for (const m of materials) {
    if (!isSupplierPricedMaterial(m.type)) continue
    const type = m.type.trim() || 'Stone'
    out.push({
      owner: { supplierId: m.supplierId, supplierName: m.supplierName },
      ask: {
        key: materialQuantityKey.material(m.id),
        label: [type, m.description.trim(), m.colour?.trim() ?? ''].filter(Boolean).join(' · '),
        details: m.details.trim(),
        unit: materialQuantityUnit(type),
        designerQuantity: m.quantity.trim(),
        materials: [],
      },
    })
  }

  for (const sc of scatters) {
    const size = sc.size.trim()
    out.push({
      owner: { supplierId: sc.supplierId, supplierName: sc.supplierName },
      ask: {
        key: materialQuantityKey.scatter(sc.id),
        // Priced per size, so the size is the headline, not a detail
        label: size ? `Scatter ${size}` : 'Scatter',
        details: sc.details.trim(),
        unit: 'each',
        designerQuantity: sc.quantity.trim(),
        materials: sc.fabrics
          .filter(f => f.fabric.trim() || f.fabricSupplierId)
          .map(f => ({
            key: materialQuantityKey.scatterFabric(sc.id, f.id),
            label: [f.fabric.trim() || 'Fabric', f.colour?.trim() ?? ''].filter(Boolean).join(' · '),
            supplierName: f.fabricSupplierName.trim(),
            unit: 'm' as QuantityUnit,
            designerQuantity: f.fabricQuantity.trim(),
          })),
      },
    })
  }

  return out
}

/** The cloth on the item itself — the item maker's to measure. */
function itemCloth(materials: MaterialEntry[]): MaterialQuantityAsk[] {
  const asks: MaterialQuantityAsk[] = []
  for (const m of materials) {
    if (!MAKER_MEASURED_TYPES.has(m.type.trim().toLowerCase())) continue
    const type = m.type.trim() || 'Fabric'
    asks.push({
      key: materialQuantityKey.material(m.id),
      label: [type, m.description.trim(), m.colour?.trim() ?? ''].filter(Boolean).join(' · '),
      supplierName: m.supplierName.trim(),
      unit: 'm',
      designerQuantity: m.quantity.trim(),
    })
    // A second cloth on the same piece is its own order, so its own box
    for (const f of m.extraFabrics) {
      asks.push({
        key: materialQuantityKey.extraFabric(m.id, f.id),
        label: [type, f.fabric.trim(), f.colour?.trim() ?? ''].filter(Boolean).join(' · '),
        supplierName: f.fabricSupplierName.trim(),
        unit: 'm',
        designerQuantity: f.fabricQuantity.trim(),
      })
    }
  }
  return asks
}

/**
 * Narrow a spec to the slice one recipient is responsible for.
 *
 * Owning a component is what makes a sheet a component sheet: a recipient who
 * supplies one of the scatters is there for the scatters, not the sofa. Anyone
 * else on the request is being asked about the item — including a second
 * upholsterer added for comparison, who is not the supplier named on the spec
 * but is certainly quoting the piece.
 *
 * Anything with nobody named against it falls to the item's maker, so a
 * half-filled spec still reaches someone rather than silently reaching nobody.
 */
export function buildSpecSheet(
  materials: MaterialEntry[],
  scatters: ScatterEntry[],
  itemSupplier: SupplierRef,
  audience: SupplierRef
): SpecSheet {
  const components = allComponents(materials, scatters)
  const ownsAComponent = components.some(c => !unassigned(c.owner) && sameSupplier(c.owner, audience))
  const ownsItem = sameSupplier(itemSupplier, audience) || !ownsAComponent

  return {
    ownsItem,
    itemMaterials: ownsItem ? itemCloth(materials) : [],
    components: components
      .filter(c =>
        unassigned(c.owner) ? ownsItem : sameSupplier(c.owner, audience)
      )
      .map(c => c.ask),
  }
}

/**
 * One answer as the supplier submitted it, stored on their spec_quotes row.
 * `label` and `designerQuantity` are snapshots taken at submission time: the
 * spec can be edited afterwards, and what the supplier was looking at when
 * they answered is the only thing worth keeping a record of.
 */
export interface SupplierMaterialQuantity {
  key: string
  label: string
  /** The figure, or null where the supplier left the box empty. */
  quantity: number | null
  /** Set only on a component the supplier prices — cloth carries no price. */
  price: number | null
  /** What it is measured in — snapshot, same reasoning as `label`. */
  unit: string
  designerQuantity: string
}

/**
 * Answers stored before components existed have no `price` key at all, and an
 * absent price is not a price: `undefined !== null` reads as one, which would
 * write `undefined` onto a cost. Every read of the stored JSON goes through
 * here so a missing field can only ever mean "not answered".
 */
export function normalizeSupplierQuantity(
  q: Partial<SupplierMaterialQuantity> & { key: string }
): SupplierMaterialQuantity {
  return {
    key: q.key,
    label: q.label ?? '',
    quantity: q.quantity ?? null,
    price: q.price ?? null,
    unit: q.unit ?? 'm',
    designerQuantity: q.designerQuantity ?? '',
  }
}

// A one-line human summary of a fabric — "2.5 m Linen Natural — Hertex".
// Shared by the RFQ PDF and the supplier pricing page so the supplier reads
// the same string in both.
export function fabricLineSummary(f: FabricLine): string {
  return [
    f.fabricQuantity.trim() ? `${f.fabricQuantity.trim()} m` : '',
    f.fabric.trim(),
    f.colour?.trim() ?? '',
    f.fabricSupplierName.trim() ? `via ${f.fabricSupplierName.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' — ')
}

// A crop rect in SOURCE pixels — the same shape ImageObject.crop uses, so a
// board image and a spec image are croppable by identical maths.
export interface ImageCropRect {
  x: number
  y: number
  width: number
  height: number
}

// Extra reference images for the same item, beyond the one placed on the
// board — a back view, a detail shot, a drawing. Stored on the spec (not the
// slide) because they belong to the ITEM, not to the layout: they never render
// on the moodboard, they travel with the spec to the supplier.
export interface SpecImage {
  id: string
  url: string
  naturalWidth: number
  naturalHeight: number
  caption: string
}

export function normalizeSpecImage(img: Partial<SpecImage> & { id: string; url: string }): SpecImage {
  return {
    id: img.id,
    url: img.url,
    naturalWidth: img.naturalWidth ?? 0,
    naturalHeight: img.naturalHeight ?? 0,
    caption: img.caption ?? '',
  }
}

export type SpecStatus = 'draft' | 'approved'

// One RFQ email recipient (a spec can be sent to several suppliers for
// price comparison — each gets their own email, never CC'd together)
export interface RfqRecipientStamp {
  supplierName: string
  email: string
  at: string // ISO timestamp
}

/**
 * How far one quote request got, as served by
 * /api/studio/boards/[id]/rfq-status and shown per item in the Procurement
 * panel. A recipient stamp (above) records only that an email was sent;
 * this is what came back.
 */
export interface RfqStatusRequest {
  id: string
  supplierName: string
  supplierEmail: string
  sentAt: string
  /** Supplier loaded the pricing page in a browser. Never an email open. */
  openedAt: string | null
  submittedAt: string | null
  expiresAt: string
}

export interface StudioSpec {
  id: string
  objectId: string
  slideId: string
  specName: string
  description: string
  notes: string
  supplierId: string | null
  supplierName: string
  category: string
  quantity: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  scatters: ScatterEntry[]
  // Extra reference images for this item — see SpecImage
  images: SpecImage[]
  status: SpecStatus
  // RFQ tracking — stamped server-side when quote-request emails go out
  rfqSentAt: string | null
  rfqSentTo: RfqRecipientStamp[]
  // Set when this spec was placed from the Pieces catalog. item_specs is a
  // SNAPSHOT taken at placement time (same shape as pieces.item_specs) —
  // editing it here never writes back to the catalog piece, and re-pulling
  // is a deliberate, manual "refresh from piece" action, never automatic.
  pieceId: string | null
  itemSpecs: Record<string, string>
}

export interface StudioSpecRow {
  id: string
  board_id: string
  org_id: string
  slide_id: string
  object_id: string
  spec_name: string
  description: string
  notes: string
  supplier_id: string | null
  supplier_name: string
  category: string
  quantity: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  scatters?: ScatterEntry[] | null
  images?: SpecImage[] | null
  status: SpecStatus
  rfq_sent_at?: string | null
  rfq_sent_to?: RfqRecipientStamp[]
  piece_id?: string | null
  item_specs?: Record<string, string> | null
}

/**
 * Every column specFromRow reads, as one list both spec queries select through.
 *
 * It was previously spelled out at each call site, and both copies had drifted:
 * neither selected rfq_sent_at/rfq_sent_to, so specFromRow fell back to null and
 * no "RFQ sent" line ever survived a reload — the data was in the table the
 * whole time. A list that silently blanks whatever it forgot only stays correct
 * if there is one of it.
 */
export const STUDIO_SPEC_COLUMNS =
  'id, board_id, org_id, slide_id, object_id, spec_name, description, notes, supplier_id, supplier_name, category, quantity, width, depth, height, materials, scatters, images, status, rfq_sent_at, rfq_sent_to, piece_id, item_specs'

export function specFromRow(row: StudioSpecRow): StudioSpec {
  return {
    id: row.id,
    objectId: row.object_id,
    slideId: row.slide_id,
    specName: row.spec_name,
    description: row.description,
    notes: row.notes,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    category: row.category,
    quantity: row.quantity,
    width: row.width,
    depth: row.depth,
    height: row.height,
    materials: Array.isArray(row.materials) ? row.materials.map(normalizeMaterial) : [],
    scatters: Array.isArray(row.scatters) ? row.scatters.map(normalizeScatter) : [],
    images: Array.isArray(row.images) ? row.images.map(normalizeSpecImage) : [],
    status: row.status === 'approved' ? 'approved' : 'draft',
    rfqSentAt: row.rfq_sent_at ?? null,
    rfqSentTo: Array.isArray(row.rfq_sent_to) ? row.rfq_sent_to : [],
    pieceId: row.piece_id ?? null,
    itemSpecs: row.item_specs ?? {},
  }
}

// Suppliers offered in the spec panel (reuses the org's existing suppliers).
// isPlatform/priceListId drive the fabric-catalogue search on Fabric
// materials — same gating logic as the line items table.
export interface SpecSupplierOption {
  id: string
  name: string
  isPlatform: boolean
  priceListId: string | null
}

// Per-board master page configuration, backing the "Master Theme" settings
// panel. Every board has one active theme (see masterThemes.ts) — there's no
// "off" switch, just a choice of theme and which of its elements to show.
// Only bindingMarginMm is board-adjustable — the other margins are fixed
// per theme.
export interface MasterLayoutConfig {
  themeId: string
  showBorder: boolean
  showHeader: boolean
  showFooter: boolean
  showLogo: boolean
  showPageNumber: boolean
  bindingMarginMm: number
  // Board-wide font (contentFonts.ts) — overrides every text object's own
  // font on every slide, so the whole board reads as one consistent brand.
  // Does not affect the master heading/footer, which stay theme-controlled.
  contentFontId: string
}

export const DEFAULT_MASTER_LAYOUT: MasterLayoutConfig = {
  themeId: 'minimal-white',
  contentFontId: 'inter',
  showBorder: true,
  showHeader: true,
  showFooter: true,
  showLogo: true,
  showPageNumber: true,
  bindingMarginMm: 35,
}

export function masterLayoutFromJson(json: unknown): MasterLayoutConfig {
  const j = (json ?? {}) as Partial<MasterLayoutConfig>
  return { ...DEFAULT_MASTER_LAYOUT, ...j }
}

export interface StudioBoardRow {
  id: string
  org_id: string
  client_id: string
  project_id: string | null // optional link, used by future quote/procurement sprints
  name: string
  last_state: BoardLastState | null
}

export interface StudioSlideRow {
  id: string
  board_id: string
  org_id: string
  name: string
  heading: string
  sort_order: number
  objects: StudioObject[]
  is_cover?: boolean
}

export function slideFromRow(row: StudioSlideRow): StudioSlide {
  return {
    id: row.id,
    name: row.name,
    heading: row.heading,
    sortOrder: row.sort_order,
    objects: Array.isArray(row.objects) ? row.objects : [],
    isCover: row.is_cover ?? false,
  }
}
