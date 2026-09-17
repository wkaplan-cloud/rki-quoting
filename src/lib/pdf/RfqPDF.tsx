import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { CATEGORY_FIELDS, categoryLabel, type CategoryKey } from '@/lib/sourcing-categories'

// Request-for-quote document sent to a supplier from a Studio moodboard.
// One page per item: image on the left, spec details on the right. Prices are
// deliberately absent — the supplier fills those in. Images may be reference
// pictures or drawings of custom pieces, which the intro line calls out.

export interface RfqPdfItem {
  name: string
  area: string // room/area — the slide heading the item sits on
  // The board image, already cut to the designer's crop before it gets here —
  // the framing IS part of the brief, so the supplier must never see the
  // uncropped original.
  imageUrl: string | null
  // Extra views of the same item (back, detail, drawing) — shown under the
  // main image so the supplier prices the whole piece, not one angle.
  extraImageUrls: string[]
  description: string
  category: string
  quantity: string
  width: string
  depth: string
  height: string
  materials: {
    type: string
    description: string
    supplierName: string
    colour: string | null
    quantity: string
    // Free text saying where this material's fabrics go on the piece
    details: string
  }[]
  notes: string
  // Category-specific fields (seat height, wood type, IP rating, etc.) —
  // the supplier needs these to price accurately, not just a photo and
  // rough dimensions.
  itemSpecs: Record<string, string>
  /**
   * Whether this sheet is for the person making the piece. False for a
   * component supplier — the cushion workroom, the stone yard — who gets the
   * picture, the name and their own part, and none of the item's spec.
   */
  ownsItem: boolean
  // Material on the item to measure, as a rule to write the figure on. Built
  // from the same sheet as the online form, so a supplier working off paper
  // answers exactly the same questions, in the same order, as one on screen.
  itemMaterials: PdfMeasure[]
  /** What this supplier makes: priced, counted, and measured for its cloth. */
  components: {
    label: string
    details: string
    unit: string
    designerQuantity: string
    materials: PdfMeasure[]
  }[]
}

/** One "how much of this?" rule on the completion box. */
export interface PdfMeasure {
  label: string
  supplierName: string
  unit: string
}

export interface RfqPdfProps {
  businessName: string
  logoUrl?: string | null
  boardName: string
  clientName: string
  supplierName: string
  message: string
  replyTo: string | null
  printDate: string
  items: RfqPdfItem[]
}

const s = StyleSheet.create({
  // ── Cover ──
  cover: { padding: 56, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A', backgroundColor: '#FFFFFF' },
  kicker: { fontSize: 9, color: '#9A7B4F', textTransform: 'uppercase', letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  logo: { height: 40, objectFit: 'contain' },
  bizTop: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: '#1A1A18', letterSpacing: 0.2, lineHeight: 1.15 },
  coverClient: { fontSize: 13, color: '#8A877F', marginTop: 8 },
  goldRule: { width: 48, height: 3, backgroundColor: '#C4A46B', marginTop: 20 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 40 },
  metaCell: { width: '33.33%', marginBottom: 22, paddingRight: 12 },
  messagePanel: { backgroundColor: '#F5F2EC', borderWidth: 1, borderColor: '#E5E0D6', borderRadius: 6, padding: 16, marginTop: 6 },
  refNote: { fontSize: 8, color: '#8A877F', lineHeight: 1.6, marginTop: 14 },
  thumb: { width: 84, height: 84, objectFit: 'cover', borderWidth: 1, borderColor: '#D8D3C8', marginRight: 8, borderRadius: 4 },
  thumbEmpty: { width: 84, height: 84, borderWidth: 1, borderColor: '#D8D3C8', marginRight: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EC' },
  thumbMore: { width: 84, height: 84, borderWidth: 1, borderColor: '#D8D3C8', marginRight: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A18' },
  // ── Shared / item pages ──
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A' },
  muted: { color: '#8A877F' },
  metaLabel: { fontSize: 7, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 },
  metaValue: { fontSize: 11, color: '#1A1A18' },
  message: { fontSize: 10, lineHeight: 1.6, color: '#4A4A47' },
  itemPage: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A' },
  itemHeader: { fontSize: 8, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  itemName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  // A4 portrait is 595pt wide; with 40pt page padding the content column is
  // ~515pt — the image fills it (fixed height so it can never squeeze the
  // specs), specs sit underneath IN FULL. Long specs flow onto a follow-on
  // page with a fixed "— continued" header so it reads as one item.
  imageBox: { width: '100%', height: 300, borderWidth: 1, borderColor: '#D8D3C8', padding: 4, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  image: { maxWidth: 505, maxHeight: 290, objectFit: 'contain' },
  extraStrip: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  extraThumb: { width: 96, height: 96, objectFit: 'cover', borderWidth: 1, borderColor: '#D8D3C8', marginRight: 6, marginBottom: 6, borderRadius: 3 },
  specs: { width: '100%' },
  specRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  specLabel: { width: 80, fontSize: 8, color: '#8A877F' },
  specValue: { flex: 1, fontSize: 9 },
  sectionHead: { fontSize: 8, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  notes: { fontSize: 9, lineHeight: 1.5, color: '#4A4A47' },
  contHeader: { position: 'absolute', top: 22, left: 40, right: 40, fontSize: 8, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1 },
  area: { fontSize: 9, color: '#9A7B4F', marginBottom: 10, marginTop: -8 },
  // Tight on purpose: this box holds a rule per cloth now, and at roomier
  // spacing a sofa in three fabrics pushed the whole thing onto a page of its
  // own — leaving the item's own page a quarter empty and the supplier
  // writing metres with the spec no longer in front of them.
  priceBox: { marginTop: 12, borderWidth: 1, borderColor: '#D8D3C8', padding: 8 },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  // A cloth's name can run long ("Fabric · Cotswold Weave Oatmeal"), so its
  // label takes the slack and the rule it writes on stays put on the right
  fillLabel: { flex: 1, paddingRight: 10, color: '#8A877F' },
  fillRule: { width: 132, textAlign: 'right' },
  fillNote: { fontSize: 7, color: '#8A877F', marginTop: 5, lineHeight: 1.4 },
  // A component's name, heading the two or three rules that belong to it
  componentHead: { fontFamily: 'Helvetica-Bold', color: '#2C2C2A', marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#8A877F' },
})

// ── One item, one page ──────────────────────────────────────────────────────
// An item that spills onto a second page splits the brief in half: the
// supplier writes their metres on a rule with the spec no longer in front of
// them, and a "(continued)" page reads as a second item at a glance. So the
// page is treated as a fixed budget — the photo gives up whatever height the
// specs need, and if that is not enough the spacing tightens before anything
// is allowed to overflow.

// A4 at 72dpi is 595.28 × 841.89pt. The item page pads 40 all round, and the
// footer sits 24pt off the bottom, so this is what the flow actually has.
const PAGE_W = 595.28
const PAGE_H = 841.89
const PAGE_PAD = 40
const FOOTER_CLEARANCE = 18
const CONTENT_W = PAGE_W - PAGE_PAD * 2
const CONTENT_H = PAGE_H - PAGE_PAD * 2 - FOOTER_CLEARANCE

// Below the floor a photo stops being a brief and becomes a stamp, so that is
// where shrinking it stops and the spacing gives way instead.
const IMAGE_MAX = 300
const IMAGE_MIN = 120
// Where the photo ends up on an item whose spec fills the page on its own —
// small, but enough to tell the supplier which piece they are costing.
const IMAGE_FLOOR = 64

// Helvetica averages a little over half its point size per character across
// mixed-case text. Deliberately generous: over-estimating a line costs a few
// points of photo, under-estimating costs the whole guarantee.
const CHAR_W = 0.54
const LINE = 1.25

/** How many lines `text` takes at `fontSize` in a column `width` wide. */
function linesOf(text: string, fontSize: number, width: number): number {
  if (!text.trim()) return 0
  return Math.max(1, Math.ceil((text.length * fontSize * CHAR_W) / width))
}

/** The spacing and type size that give way when an item's specs won't fit. */
interface Density {
  rowPad: number
  sectionTop: number
  noteLine: number
  fillPad: number
  thumb: number
  headGap: number
  /** Body type size. Shrinks last, and never below what a workshop can read. */
  font: number
  labelWidth: number
}

// Tried in order. Spacing goes first because nobody misses it; type size only
// when an item is genuinely long, and 7.5pt is the floor — below that the
// sheet stops being something a supplier can work off a workbench.
const DENSITIES: Density[] = [
  { rowPad: 4, sectionTop: 12, noteLine: 1.5, fillPad: 4, thumb: 96, headGap: 10, font: 9, labelWidth: 80 },
  { rowPad: 2, sectionTop: 7, noteLine: 1.3, fillPad: 2.5, thumb: 70, headGap: 6, font: 9, labelWidth: 80 },
  { rowPad: 2, sectionTop: 6, noteLine: 1.3, fillPad: 2, thumb: 60, headGap: 5, font: 8, labelWidth: 72 },
  { rowPad: 1.5, sectionTop: 5, noteLine: 1.25, fillPad: 1.5, thumb: 52, headGap: 4, font: 7.5, labelWidth: 66 },
]

/** One spec row's height, including a value that wraps. */
const rowH = (value: string, d: Density) =>
  Math.max(1, linesOf(value, d.font, CONTENT_W - d.labelWidth)) * d.font * LINE + d.rowPad * 2 + 0.5

const sectionH = (d: Density) => d.font * LINE + d.sectionTop + 4

/** Everything on the page except the photo, at a given density. */
function heightWithoutImage(item: RfqPdfItem, d: Density): number {
  let h = 0
  h += 8 * LINE + 8 // "ITEM n OF m"
  h += Math.max(1, linesOf(item.name || 'Item', 14, CONTENT_W)) * 14 * LINE + d.headGap
  if (item.area.trim()) h += d.font * LINE + 10 - (d.headGap - 2) // .area pulls up under the name
  h += 12 // the image box's own bottom margin

  if (item.extraImageUrls.length > 0) {
    const perRow = Math.max(1, Math.floor(CONTENT_W / (d.thumb + 6)))
    h += d.font * LINE + 4 + Math.ceil(item.extraImageUrls.length / perRow) * (d.thumb + 6) + 12
  }

  // The item's own spec, which only its maker is shown
  if (item.ownsItem) {
    for (const v of [item.description, categoryLabel(item.category), item.quantity, dims(item)]) {
      if (v.trim()) h += rowH(v, d)
    }

    const specFields = (CATEGORY_FIELDS[item.category as CategoryKey] ?? []).filter(f =>
      item.itemSpecs[f.key]?.trim()
    )
    if (specFields.length) {
      h += sectionH(d)
      for (const f of specFields) h += rowH(item.itemSpecs[f.key], d)
    }

    if (item.materials.length) {
      h += sectionH(d)
      for (const m of item.materials) h += rowH(materialLine(m), d)
    }

    if (item.notes.trim()) {
      h += sectionH(d) + linesOf(item.notes, d.font, CONTENT_W) * d.font * d.noteLine
    }
  } else {
    h += linesOf(componentIntro(item), d.font, CONTENT_W) * d.font * d.noteLine
  }

  // The completion box
  const fillW = CONTENT_W - 16 - 132 - 10
  const fillLine = (label: string) =>
    Math.max(1, linesOf(label, d.font, fillW)) * d.font * LINE + d.fillPad * 2 + 0.5
  const measureLine = (m: PdfMeasure) =>
    fillLine(`${m.label}${m.supplierName ? ` (from ${m.supplierName})` : ''}`)

  h += 12 + 16 + 2 + (d.font * LINE + 4) // margin, padding, border, its heading
  if (item.ownsItem) {
    h += fillLine('Unit price (excl. VAT) — for one of 00')
    for (const m of item.itemMaterials) h += measureLine(m)
  }
  for (const c of item.components) {
    // Its name, then price, then count, then a rule per cloth on it
    h += Math.max(1, linesOf(`${c.label} · ${c.details}`, d.font, CONTENT_W - 16)) * d.font * LINE
    h += d.fillPad + 4 + 2
    h += fillLine(`Price ${c.unit === 'each' ? 'each' : `per ${c.unit}`} (excl. VAT)`)
    h += fillLine(`${c.unit === 'each' ? 'How many' : 'Area needed'} (spec says 00)`)
    for (const m of c.materials) h += measureLine(m)
  }
  if (item.itemMaterials.length + item.components.length > 0) h += 7 * 1.4 + 5

  return h
}

/**
 * The photo height and spacing this item gets, so that it lands on one page.
 * Roomy first; tighten only when the specs actually demand it, so a short item
 * is never squeezed for the sake of a long one elsewhere in the document.
 */
function fitItemToPage(item: RfqPdfItem): { imageHeight: number; d: Density } {
  // Pass one: keep a photo worth looking at, spending spacing then type size
  for (const d of DENSITIES) {
    const room = CONTENT_H - heightWithoutImage(item, d)
    if (room >= IMAGE_MIN) return { imageHeight: Math.min(IMAGE_MAX, room), d }
  }
  // Pass two: an item this long has to give up the photo's size as well. A
  // thumbnail still says which piece this is, and the page stays whole.
  const tightest = DENSITIES[DENSITIES.length - 1]
  const room = CONTENT_H - heightWithoutImage(item, tightest)
  return { imageHeight: Math.max(IMAGE_FLOOR, Math.min(IMAGE_MAX, room)), d: tightest }
}

/** The Materials row text — shared with the estimate so both agree. */
function materialLine(m: RfqPdfItem['materials'][number]): string {
  return [m.description, m.colour, m.quantity.trim() ? `${m.quantity.trim()} m` : '', m.supplierName ? `via ${m.supplierName}` : '', m.details]
    .filter(v => v && v.trim())
    .join(' · ')
}

/**
 * What a component supplier is looking at, in one line. Deliberately does not
 * name the parts: they are listed in full below with their own rules, and a
 * label like "Stone · Nero Marquina top" does not survive being folded into a
 * sentence.
 */
function componentIntro(item: RfqPdfItem): string {
  if (item.components.length === 0) return ''
  return 'Someone else is making this piece. You are being asked only for the parts listed below — the picture above is for context.'
}

/** One "how much of this?" rule, wherever it hangs. */
function MeasureLine({ measure, d, last }: { measure: PdfMeasure; d: Density; last: boolean }) {
  return (
    <View style={[s.priceLine, { paddingVertical: d.fillPad }, last ? { borderBottomWidth: 0 } : {}]}>
      <Text style={[s.fillLabel, { fontSize: d.font }]}>
        {measure.label}{measure.supplierName ? ` (from ${measure.supplierName})` : ''}
      </Text>
      <Text style={[s.fillRule, { fontSize: d.font }]}>____________ {measure.unit}</Text>
    </View>
  )
}

/**
 * " — for one of 4", or nothing. A supplier reading "Quantity: 4" in the specs
 * and a bare "Unit price" at the bottom has every reason to write the total
 * for all four on the rule, which is the mistake this says out loud. Only a
 * plain count qualifies: "4 off" reads as four, anything unparseable is left
 * alone rather than asserted.
 */
function unitCountLabel(quantity: string): string {
  const n = parseFloat(quantity)
  return Number.isFinite(n) && n > 1 ? ` — for one of ${n}` : ''
}

function dims(item: RfqPdfItem): string {
  const parts = [item.width, item.depth, item.height].map(v => v.trim())
  if (parts.every(p => !p)) return ''
  return parts.map(p => p || '—').join(' × ') + ' (W × D × H)'
}

export function RfqPDF(props: RfqPdfProps) {
  const { businessName, logoUrl, boardName, clientName, supplierName, message, replyTo, printDate, items } = props
  return (
    <Document>
      {/* Cover — the supplier's first impression of the studio, so it gets
          letterhead treatment: kicker + logo, big title block, airy meta
          grid, message panel, and a thumbnail strip of what's inside */}
      <Page size="A4" style={s.cover}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={s.kicker}>Request for Quote</Text>
            {logoUrl ? <Text style={[s.bizTop, { marginTop: 6 }]}>{businessName}</Text> : null}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl ? <Image src={logoUrl} style={s.logo} /> : <Text style={s.bizTop}>{businessName}</Text>}
        </View>

        <View style={{ marginTop: 72 }}>
          <Text style={s.coverTitle}>{boardName}</Text>
          {clientName ? <Text style={s.coverClient}>for {clientName}</Text> : null}
          <View style={s.goldRule} />
        </View>

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Prepared for</Text>
            <Text style={s.metaValue}>{supplierName}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>From</Text>
            <Text style={s.metaValue}>{businessName}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{printDate}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Items to price</Text>
            <Text style={s.metaValue}>{String(items.length)}</Text>
          </View>
          {replyTo ? (
            <View style={[s.metaCell, { width: '66.66%' }]}>
              <Text style={s.metaLabel}>Send pricing to</Text>
              <Text style={s.metaValue}>{replyTo}</Text>
            </View>
          ) : null}
        </View>

        {message ? (
          <View style={s.messagePanel}>
            <Text style={s.metaLabel}>Message</Text>
            <Text style={s.message}>{message}</Text>
          </View>
        ) : null}
        <Text style={s.refNote}>
          Please note: images may be reference pictures or drawings of custom pieces — quote per the
          specifications given for each item on the following pages.
          {' '}
          {/* Says what this particular sheet is asking for. A cushion workroom
              is not quoting the sofa, so telling them prices are per item
              would be telling them the wrong thing. */}
          {items.every(it => !it.ownsItem)
            ? 'You are being asked for the parts listed on each page, not for the pieces they go on.'
            : 'Prices are for one of each item, not for the whole quantity.'}
          {items.some(it => it.itemMaterials.length + it.components.length > 0)
            ? ' Where a page asks for a quantity, please fill it in — every material is ordered' +
              ' separately, so we need them one by one rather than as a total.'
            : ''}
        </Text>

        <View style={{ flexGrow: 1 }} />

        <View>
          <Text style={s.metaLabel}>In this request</Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {items.slice(0, 5).map((item, j) =>
              item.imageUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image key={j} src={item.imageUrl} style={s.thumb} />
              ) : (
                <View key={j} style={s.thumbEmpty}>
                  <Text style={[s.muted, { fontSize: 7 }]}>No image</Text>
                </View>
              )
            )}
            {items.length > 5 ? (
              <View style={s.thumbMore}>
                <Text style={{ fontSize: 12, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' }}>
                  +{items.length - 5}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{businessName} — Request for Quote</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* One page per item */}
      {items.map((item, i) => {
        // The photo yields height to the specs so the item stays on one page
        const { imageHeight, d } = fitItemToPage(item)
        return (
        <Page key={i} size="A4" style={s.itemPage}>
          {/* Only visible on this item's overflow pages, so a spilled spec
              clearly reads as a continuation, not a new item */}
          <Text
            fixed
            style={s.contHeader}
            render={({ subPageNumber }) =>
              subPageNumber > 1 ? `Item ${i + 1} — ${item.name || `Item ${i + 1}`} (continued)` : ''
            }
          />
          <Text style={s.itemHeader}>Item {i + 1} of {items.length}</Text>
          <Text style={[s.itemName, { marginBottom: d.headGap }]}>{item.name || `Item ${i + 1}`}</Text>
          {/* .area pulls itself up under the name; the pull has to track the
              gap it is closing, or at tight spacing it lands in the name's
              descenders */}
          {item.area.trim() ? (
            <Text style={[s.area, { fontSize: d.font, marginTop: -(d.headGap - 2) }]}>{item.area}</Text>
          ) : null}
          <View style={[s.imageBox, { height: imageHeight }]}>
            {item.imageUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={item.imageUrl} style={[s.image, { maxHeight: imageHeight - 10 }]} />
            ) : (
              <Text style={s.muted}>No image</Text>
            )}
          </View>
          {item.extraImageUrls.length > 0 ? (
            <View wrap={false}>
              <Text style={[s.sectionHead, { marginTop: 0, fontSize: d.font - 1 }]}>More views</Text>
              <View style={s.extraStrip}>
                {item.extraImageUrls.map((u, j) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image key={j} src={u} style={[s.extraThumb, { width: d.thumb, height: d.thumb }]} />
                ))}
              </View>
            </View>
          ) : null}
          {/* A component supplier is shown the picture and the name so they
              know what their part goes on, and nothing else: they are not
              quoting the piece, and its dimensions, cloth and notes are not
              theirs to answer for. */}
          <View style={s.specs}>
              {item.ownsItem ? (
                <>
              {item.description.trim() ? (
                <View style={[s.specRow, { paddingVertical: d.rowPad }]} wrap={false}>
                  <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>Description</Text>
                  <Text style={[s.specValue, { fontSize: d.font }]}>{item.description}</Text>
                </View>
              ) : null}
              {/* item.category stays the raw key — CATEGORY_FIELDS is keyed by
                  it below — so the label is resolved here at the point of print */}
              {categoryLabel(item.category) ? (
                <View style={[s.specRow, { paddingVertical: d.rowPad }]} wrap={false}>
                  <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>Category</Text>
                  <Text style={[s.specValue, { fontSize: d.font }]}>{categoryLabel(item.category)}</Text>
                </View>
              ) : null}
              {item.quantity.trim() ? (
                <View style={[s.specRow, { paddingVertical: d.rowPad }]} wrap={false}>
                  <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>Quantity</Text>
                  <Text style={[s.specValue, { fontSize: d.font }]}>{item.quantity}</Text>
                </View>
              ) : null}
              {dims(item) ? (
                <View style={[s.specRow, { paddingVertical: d.rowPad }]} wrap={false}>
                  <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>Dimensions</Text>
                  <Text style={[s.specValue, { fontSize: d.font }]}>{dims(item)}</Text>
                </View>
              ) : null}

              {(CATEGORY_FIELDS[item.category as CategoryKey] ?? []).some(f => item.itemSpecs[f.key]?.trim()) ? (
                <>
                  <Text style={[s.sectionHead, { marginTop: d.sectionTop, fontSize: d.font - 1 }]} minPresenceAhead={30}>Specifications</Text>
                  {(CATEGORY_FIELDS[item.category as CategoryKey] ?? [])
                    .filter(f => item.itemSpecs[f.key]?.trim())
                    .map(f => (
                      <View key={f.key} style={s.specRow} wrap={false}>
                        <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>{f.label}</Text>
                        <Text style={[s.specValue, { fontSize: d.font }]}>
                          {item.itemSpecs[f.key]}{f.unit ? ` ${f.unit}` : ''}
                        </Text>
                      </View>
                    ))}
                </>
              ) : null}

              {item.materials.length > 0 ? (
                <>
                  <Text style={[s.sectionHead, { marginTop: d.sectionTop, fontSize: d.font - 1 }]} minPresenceAhead={30}>Materials</Text>
                  {item.materials.map((m, j) => (
                    <View key={j} style={s.specRow} wrap={false}>
                      <Text style={[s.specLabel, { width: d.labelWidth, fontSize: d.font - 1 }]}>{m.type || 'Material'}</Text>
                      <Text style={[s.specValue, { fontSize: d.font }]}>{materialLine(m)}</Text>
                    </View>
                  ))}
                </>
              ) : null}

              {item.notes.trim() ? (
                <>
                  <Text style={[s.sectionHead, { marginTop: d.sectionTop, fontSize: d.font - 1 }]} minPresenceAhead={30}>Notes</Text>
                  <Text style={[s.notes, { lineHeight: d.noteLine, fontSize: d.font }]}>{item.notes}</Text>
                </>
              ) : null}
                </>
              ) : (
                <Text style={[s.notes, { fontSize: d.font, lineHeight: d.noteLine }]}>
                  {componentIntro(item)}
                </Text>
              )}

              <View style={s.priceBox} wrap={false}>
                <Text style={[s.sectionHead, { marginTop: 0, fontSize: d.font - 1 }]}>For supplier completion</Text>
                {/* The piece itself, priced per unit, then a rule for each
                    material the maker measures. */}
                {item.ownsItem ? (
                  <>
                    <View
                      style={[
                        s.priceLine,
                        { paddingVertical: d.fillPad },
                        item.itemMaterials.length === 0 && item.components.length === 0
                          ? { borderBottomWidth: 0 }
                          : {},
                      ]}
                    >
                      <Text style={[s.fillLabel, { fontSize: d.font }]}>
                        Unit price (excl. VAT){unitCountLabel(item.quantity)}
                      </Text>
                      <Text style={[s.fillRule, { fontSize: d.font }]}>R ____________________</Text>
                    </View>
                    {item.itemMaterials.map((m, j) => (
                      <MeasureLine
                        key={j}
                        measure={m}
                        d={d}
                        last={j === item.itemMaterials.length - 1 && item.components.length === 0}
                      />
                    ))}
                  </>
                ) : null}

                {/* Each component priced by the size it is made in and counted
                    on its own: two sizes of scatter are two different things to
                    order, not one line with an average price. */}
                {item.components.map((c, j) => {
                  const perOne = c.unit === 'each' ? 'each' : `per ${c.unit}`
                  const lastComponent = j === item.components.length - 1
                  return (
                    <View key={j}>
                      <Text
                        style={[
                          s.componentHead,
                          { fontSize: d.font, marginTop: j === 0 && !item.ownsItem ? 4 : d.fillPad + 4 },
                        ]}
                      >
                        {c.label}
                        {c.details.trim() ? <Text style={s.muted}>  ·  {c.details.trim()}</Text> : null}
                      </Text>
                      <View style={[s.priceLine, { paddingVertical: d.fillPad }]}>
                        <Text style={[s.fillLabel, { fontSize: d.font }]}>Price {perOne} (excl. VAT)</Text>
                        <Text style={[s.fillRule, { fontSize: d.font }]}>R ____________________</Text>
                      </View>
                      <View
                        style={[
                          s.priceLine,
                          { paddingVertical: d.fillPad },
                          lastComponent && c.materials.length === 0 ? { borderBottomWidth: 0 } : {},
                        ]}
                      >
                        <Text style={[s.fillLabel, { fontSize: d.font }]}>
                          {c.unit === 'each' ? 'How many' : 'Area needed'}
                          {c.designerQuantity.trim() ? (
                            <Text style={s.muted}>  (spec says {c.designerQuantity.trim()})</Text>
                          ) : null}
                        </Text>
                        <Text style={[s.fillRule, { fontSize: d.font }]}>
                          ____________ {c.unit === 'each' ? '' : c.unit}
                        </Text>
                      </View>
                      {c.materials.map((m, k) => (
                        <MeasureLine
                          key={k}
                          measure={m}
                          d={d}
                          last={lastComponent && k === c.materials.length - 1}
                        />
                      ))}
                    </View>
                  )
                })}

                {item.itemMaterials.length + item.components.length > 0 ? (
                  <Text style={s.fillNote}>
                    Each is ordered on its own — please give every quantity separately.
                  </Text>
                ) : null}
              </View>
            </View>
          <View style={s.footer} fixed>
            <Text>{businessName} — {boardName}</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
        )
      })}
    </Document>
  )
}
