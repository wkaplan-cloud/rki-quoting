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
  unit: string
  width: string
  depth: string
  height: string
  materials: {
    type: string
    description: string
    supplierName: string
    colour: string | null
    quantity: string
  }[]
  // Scatter cushions — separately supplied and separately priced
  scatters: {
    supplierName: string
    fabricSupplierName: string
    fabricQuantity: string
    fabric: string
    colour: string | null
    size: string
    quantity: string
    details: string
  }[]
  notes: string
  // Category-specific fields (seat height, wood type, IP rating, etc.) —
  // the supplier needs these to price accurately, not just a photo and
  // rough dimensions.
  itemSpecs: Record<string, string>
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
  priceBox: { marginTop: 16, borderWidth: 1, borderColor: '#D8D3C8', padding: 10 },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#8A877F' },
})

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
      {items.map((item, i) => (
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
          <Text style={s.itemName}>{item.name || `Item ${i + 1}`}</Text>
          {item.area.trim() ? <Text style={s.area}>{item.area}</Text> : null}
          <View style={s.imageBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {item.imageUrl ? <Image src={item.imageUrl} style={s.image} /> : <Text style={s.muted}>No image</Text>}
          </View>
          {item.extraImageUrls.length > 0 ? (
            <View wrap={false}>
              <Text style={[s.sectionHead, { marginTop: 0 }]}>More views</Text>
              <View style={s.extraStrip}>
                {item.extraImageUrls.map((u, j) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image key={j} src={u} style={s.extraThumb} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={s.specs}>
              {item.description.trim() ? (
                <View style={s.specRow} wrap={false}>
                  <Text style={s.specLabel}>Description</Text>
                  <Text style={s.specValue}>{item.description}</Text>
                </View>
              ) : null}
              {/* item.category stays the raw key — CATEGORY_FIELDS is keyed by
                  it below — so the label is resolved here at the point of print */}
              {categoryLabel(item.category) ? (
                <View style={s.specRow} wrap={false}>
                  <Text style={s.specLabel}>Category</Text>
                  <Text style={s.specValue}>{categoryLabel(item.category)}</Text>
                </View>
              ) : null}
              {item.quantity.trim() ? (
                <View style={s.specRow} wrap={false}>
                  <Text style={s.specLabel}>Quantity</Text>
                  <Text style={s.specValue}>{item.quantity}{item.unit.trim() ? ` ${item.unit}` : ''}</Text>
                </View>
              ) : null}
              {dims(item) ? (
                <View style={s.specRow} wrap={false}>
                  <Text style={s.specLabel}>Dimensions</Text>
                  <Text style={s.specValue}>{dims(item)}</Text>
                </View>
              ) : null}

              {(CATEGORY_FIELDS[item.category as CategoryKey] ?? []).some(f => item.itemSpecs[f.key]?.trim()) ? (
                <>
                  <Text style={s.sectionHead} minPresenceAhead={30}>Specifications</Text>
                  {(CATEGORY_FIELDS[item.category as CategoryKey] ?? [])
                    .filter(f => item.itemSpecs[f.key]?.trim())
                    .map(f => (
                      <View key={f.key} style={s.specRow} wrap={false}>
                        <Text style={s.specLabel}>{f.label}</Text>
                        <Text style={s.specValue}>
                          {item.itemSpecs[f.key]}{f.unit ? ` ${f.unit}` : ''}
                        </Text>
                      </View>
                    ))}
                </>
              ) : null}

              {item.materials.length > 0 ? (
                <>
                  <Text style={s.sectionHead} minPresenceAhead={30}>Materials</Text>
                  {item.materials.map((m, j) => (
                    <View key={j} style={s.specRow} wrap={false}>
                      <Text style={s.specLabel}>{m.type || 'Material'}</Text>
                      <Text style={s.specValue}>
                        {[
                          m.description,
                          m.colour,
                          m.quantity.trim() ? `${m.quantity.trim()} m` : '',
                          m.supplierName ? `via ${m.supplierName}` : '',
                        ]
                          .filter(v => v && v.trim())
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {item.scatters.length > 0 ? (
                <>
                  <Text style={s.sectionHead} minPresenceAhead={30}>Scatters</Text>
                  {item.scatters.map((sc, j) => (
                    <View key={j} style={s.specRow} wrap={false}>
                      <Text style={s.specLabel}>
                        {sc.quantity.trim() ? `${sc.quantity.trim()} ×` : 'Scatter'}
                      </Text>
                      <Text style={s.specValue}>
                        {[
                          sc.size.trim(),
                          [
                            sc.fabricQuantity.trim() ? `${sc.fabricQuantity.trim()} m` : '',
                            sc.fabric.trim(),
                            sc.fabricSupplierName.trim(),
                          ]
                            .filter(Boolean)
                            .join(' — '),
                          sc.colour?.trim() ?? '',
                          sc.details.trim(),
                          sc.supplierName.trim() ? `via ${sc.supplierName.trim()}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {item.notes.trim() ? (
                <>
                  <Text style={s.sectionHead} minPresenceAhead={30}>Notes</Text>
                  <Text style={s.notes}>{item.notes}</Text>
                </>
              ) : null}

              <View style={s.priceBox} wrap={false}>
                <Text style={[s.sectionHead, { marginTop: 0 }]}>For supplier completion</Text>
                <View style={[s.priceLine, { borderBottomWidth: 0 }]}>
                  <Text style={s.muted}>Unit price (excl. VAT)</Text>
                  <Text>R ____________________</Text>
                </View>
              </View>
            </View>
          <View style={s.footer} fixed>
            <Text>{businessName} — {boardName}</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  )
}
