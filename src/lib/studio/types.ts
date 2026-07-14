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
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic'
  textDecoration: '' | 'underline'
  fill: string
  align: 'left' | 'center' | 'right'
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

export type StudioObject = ImageObject | TextObject | RectObject | EllipseObject | LineObject

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
// by content hash). Future phases attach specs/quotes to these.
export interface StudioAsset {
  id: string
  url: string
  hash: string
  naturalWidth: number
  naturalHeight: number
  fileSize: number
  createdAt: string
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
  }
}

// ── Specs Engine ────────────────────────────────────────────────────────────
// One spec per canvas object (keyed by object id). Future phases connect
// specs to quote line items and a product library via lineItemId/productId.

export interface MaterialEntry {
  id: string
  type: string // Fabric, Timber, Stone, Metal, Paint, Glass, Leather, Wallpaper…
  description: string
  // Fabric materials only: the supplier chosen for THIS material (may differ
  // from the spec's own supplier) and, when picked from the platform fabric
  // catalogue, its product identity. Deliberately no price here — the
  // convert-to-quote step looks up the CURRENT price at that moment, so a
  // spec drafted weeks earlier never quotes a stale number.
  supplierId: string | null
  supplierName: string
  twinbruProductId: number | null
  colour: string | null
  imageUrl: string | null
  widthCm: number | null
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
    twinbruProductId: m.twinbruProductId ?? null,
    colour: m.colour ?? null,
    imageUrl: m.imageUrl ?? null,
    widthCm: m.widthCm ?? null,
  }
}

export type SpecStatus = 'draft' | 'approved'

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
  unit: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  status: SpecStatus
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
  unit: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  status: SpecStatus
}

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
    unit: row.unit,
    width: row.width,
    depth: row.depth,
    height: row.height,
    materials: Array.isArray(row.materials) ? row.materials.map(normalizeMaterial) : [],
    status: row.status === 'approved' ? 'approved' : 'draft',
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
}

export const DEFAULT_MASTER_LAYOUT: MasterLayoutConfig = {
  themeId: 'minimal-white',
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
