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

export interface BoardLastState {
  slideId: string | null
  zoom: number
  panX: number
  panY: number
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

// ── Fabric & leather quantities ─────────────────────────────────────────────
// A designer specifies WHICH cloth goes on a piece; only the maker knows how
// much of it the piece eats. So the yardage is asked of the supplier on the
// pricing form rather than guessed on the board — one box per cloth, because
// a sofa in a body fabric with a contrast inside back is two separate orders
// from two possibly different houses, and one lumped figure can't be ordered.
//
// Timber, stone and paint are deliberately excluded: they are quoted into the
// maker's own price, not bought by the metre against this spec.

/** A material on the item itself, which whoever quotes the item measures. */
const ITEMS_OWN_MATERIAL = { ownerSupplierId: null, ownerSupplierName: '' }

/**
 * Cloth: bought by the metre from a house, but measured by the MAKER. The
 * upholsterer is the one who knows what the piece eats, even though the linen
 * comes from Hertex — so these boxes go to whoever is quoting the item.
 */
const MAKER_MEASURED_TYPES = new Set(['fabric', 'leather'])

/**
 * Stone: cut, fabricated and supplied by its own yard, which measures it
 * itself off the drawing. So unlike cloth, this box belongs to the material's
 * own supplier and never reaches the item's maker — the same rule scatters
 * follow. Sold by area, not by the running metre.
 */
const SUPPLIER_MEASURED_TYPES = new Set(['stone'])

export function isQuantityMaterial(type: string): boolean {
  const t = type.trim().toLowerCase()
  return MAKER_MEASURED_TYPES.has(t) || SUPPLIER_MEASURED_TYPES.has(t)
}

/** How a material is sold: cloth by the running metre, stone by area. */
export function materialQuantityUnit(type: string): QuantityUnit {
  return SUPPLIER_MEASURED_TYPES.has(type.trim().toLowerCase()) ? 'm²' : 'm'
}

export type QuantityUnit = 'm' | 'm²'

/**
 * The key that ties one cloth to its own line on the quote, all the way from
 * the spec through the supplier's form to the child line item. Stable by
 * construction: every part of it is an id already stored on the spec, so it
 * survives renaming a fabric, swapping its house or re-ordering the list.
 */
export const materialQuantityKey = {
  material: (materialId: string) => `m:${materialId}`,
  extraFabric: (materialId: string, fabricId: string) => `m:${materialId}:f:${fabricId}`,
  scatterFabric: (scatterId: string, fabricId: string) => `sc:${scatterId}:f:${fabricId}`,
}

/** One quantity box on the supplier's form, and the line it will land on. */
export interface MaterialQuantityAsk {
  key: string
  /** What the supplier is being asked about — "Fabric · Linen Natural". */
  label: string
  /** The house it comes from, shown so the maker prices make-up, not cloth. */
  supplierName: string
  /** Metres for cloth, square metres for stone. */
  unit: QuantityUnit
  /** Metres the designer allocated, if any. Usually blank — see above. */
  designerQuantity: string
  /**
   * Who makes the thing this cloth goes on, when that is somebody other than
   * the maker of the item itself. Scatters are the case this exists for: they
   * sit on the sofa's spec but are routinely made by a different workroom, so
   * the sofa's upholsterer must never be asked how much velvet the cushions
   * take. Blank means the cloth belongs to the item, and so to whoever is
   * being asked to quote it.
   */
  ownerSupplierId: string | null
  ownerSupplierName: string
}

/**
 * Every cloth on a spec the supplier should be asked to measure, in the order
 * they appear on the item. Shared by the supplier's pricing page and the
 * submit endpoint, so the boxes a supplier is shown are exactly the keys the
 * server will accept — a form built from one list and validated against
 * another is how a quantity goes missing without anybody being told.
 */
export function materialQuantityAsks(
  materials: MaterialEntry[],
  scatters: ScatterEntry[]
): MaterialQuantityAsk[] {
  const asks: MaterialQuantityAsk[] = []

  for (const m of materials) {
    if (!isQuantityMaterial(m.type)) continue
    const type = m.type.trim() || 'Fabric'
    const supplierMeasured = materialQuantityUnit(type) === 'm²'
    asks.push({
      key: materialQuantityKey.material(m.id),
      label: [type, m.description.trim(), m.colour?.trim() ?? ''].filter(Boolean).join(' · '),
      supplierName: m.supplierName.trim(),
      unit: materialQuantityUnit(type),
      designerQuantity: m.quantity.trim(),
      // Stone answers to its own yard; cloth answers to whoever makes the item
      ...(supplierMeasured
        ? { ownerSupplierId: m.supplierId, ownerSupplierName: m.supplierName.trim() }
        : ITEMS_OWN_MATERIAL),
    })
    // A second cloth on the same piece is its own order, so its own box
    for (const f of m.extraFabrics) {
      asks.push({
        key: materialQuantityKey.extraFabric(m.id, f.id),
        label: [type, f.fabric.trim(), f.colour?.trim() ?? ''].filter(Boolean).join(' · '),
        supplierName: f.fabricSupplierName.trim(),
        unit: 'm',
        designerQuantity: f.fabricQuantity.trim(),
        ...ITEMS_OWN_MATERIAL,
      })
    }
  }

  for (const sc of scatters) {
    const size = sc.size.trim()
    for (const f of sc.fabrics) {
      // A blank slot on a scatter is not a cloth anybody can measure
      if (!f.fabric.trim() && !f.fabricSupplierId) continue
      asks.push({
        key: materialQuantityKey.scatterFabric(sc.id, f.id),
        label: [size ? `Scatter ${size}` : 'Scatter', f.fabric.trim(), f.colour?.trim() ?? '']
          .filter(Boolean)
          .join(' · '),
        supplierName: f.fabricSupplierName.trim(),
        unit: 'm',
        designerQuantity: f.fabricQuantity.trim(),
        // The cushion maker, not the sofa's upholsterer — see asksForSupplier
        ownerSupplierId: sc.supplierId,
        ownerSupplierName: sc.supplierName.trim(),
      })
    }
  }

  return asks
}

/**
 * Narrow a spec's asks to the ones this recipient is actually the maker of.
 *
 * A scatter lives on the sofa's spec but is its own quotable thing with its
 * own workroom. Asking the sofa's upholsterer how much velvet the cushions
 * take invites an answer from someone who will never buy that cloth, and a
 * figure nobody should order against. So a scatter's cloths reach only the
 * supplier named on the scatter; a scatter with no supplier of its own falls
 * to whoever makes the item, and the item's own cloths always do.
 *
 * Matched on supplier id where both sides have one, and on name otherwise —
 * either side can be a name typed into the send modal that was never linked to
 * a supplier record. Name matching is the deliberate choice for that case: the
 * cost of one extra box is a supplier leaving it blank, while the cost of a
 * missing one is a cushion coming back with no yardage at all.
 */
export function asksForSupplier(
  asks: MaterialQuantityAsk[],
  audience: { supplierId: string | null; supplierName: string }
): MaterialQuantityAsk[] {
  const audienceName = audience.supplierName.trim().toLowerCase()
  return asks.filter(ask => {
    const ownerName = ask.ownerSupplierName.trim().toLowerCase()
    // No maker of its own — it belongs to the item, and so to whoever is
    // being asked to quote the item
    if (!ask.ownerSupplierId && !ownerName) return true
    if (ask.ownerSupplierId && audience.supplierId) {
      return ask.ownerSupplierId === audience.supplierId
    }
    return !!audienceName && ownerName === audienceName
  })
}

/**
 * One quantity as the supplier submitted it, stored on their spec_quotes row.
 * `label` and `designerQuantity` are snapshots taken at submission time: the
 * spec can be edited afterwards, and what the supplier was actually looking at
 * when they answered is the only thing worth keeping a record of.
 */
export interface SupplierMaterialQuantity {
  key: string
  label: string
  /** The figure, or null where the supplier left the box empty. */
  quantity: number | null
  /** What it is measured in — snapshot, same reasoning as `label`. */
  unit: QuantityUnit
  designerQuantity: string
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
