import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

// Request-for-quote document sent to a supplier from a Studio moodboard.
// One page per item: image on the left, spec details on the right. Prices are
// deliberately absent — the supplier fills those in. Images may be reference
// pictures or drawings of custom pieces, which the intro line calls out.

export interface RfqPdfItem {
  name: string
  imageUrl: string | null
  description: string
  category: string
  quantity: string
  unit: string
  width: string
  depth: string
  height: string
  materials: { type: string; description: string; supplierName: string; colour: string | null }[]
  notes: string
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
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logo: { height: 36, objectFit: 'contain', alignSelf: 'flex-start' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  muted: { color: '#8A877F' },
  metaLabel: { fontSize: 7, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 10 },
  rule: { borderBottomWidth: 1, borderBottomColor: '#D8D3C8', marginVertical: 12 },
  message: { fontSize: 9, lineHeight: 1.5, color: '#4A4A47' },
  itemPage: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#2C2C2A' },
  itemHeader: { fontSize: 8, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  itemName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  body: { flexDirection: 'row', gap: 16 },
  imageBox: { width: 250, height: 300, borderWidth: 1, borderColor: '#D8D3C8', padding: 4, justifyContent: 'center' },
  image: { maxWidth: 240, maxHeight: 290, objectFit: 'contain' },
  specs: { flex: 1 },
  specRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  specLabel: { width: 80, fontSize: 8, color: '#8A877F' },
  specValue: { flex: 1, fontSize: 9 },
  sectionHead: { fontSize: 8, color: '#8A877F', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  notes: { fontSize: 9, lineHeight: 1.5, color: '#4A4A47' },
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
      {/* Cover / letter page */}
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Request for Quote</Text>
            <Text style={[s.muted, { marginTop: 4 }]}>{businessName}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
        </View>
        <View style={s.rule} />
        <View style={{ flexDirection: 'row', gap: 32, marginBottom: 12 }}>
          <View>
            <Text style={s.metaLabel}>To</Text>
            <Text style={s.metaValue}>{supplierName}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Project</Text>
            <Text style={s.metaValue}>{boardName}{clientName ? ` — ${clientName}` : ''}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{printDate}</Text>
          </View>
          <View>
            <Text style={s.metaLabel}>Items</Text>
            <Text style={s.metaValue}>{String(items.length)}</Text>
          </View>
        </View>
        {message ? <Text style={s.message}>{message}</Text> : null}
        <Text style={[s.message, { marginTop: 10 }]}>
          Please note: images may be reference pictures or drawings of custom pieces — quote per the
          specifications given for each item on the following pages.
        </Text>
        {replyTo ? (
          <Text style={[s.message, { marginTop: 10 }]}>Please send your pricing to {replyTo} (or simply reply to the email this document arrived with).</Text>
        ) : null}
        <View style={s.footer} fixed>
          <Text>{businessName} — Request for Quote</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* One page per item */}
      {items.map((item, i) => (
        <Page key={i} size="A4" style={s.itemPage}>
          <Text style={s.itemHeader}>Item {i + 1} of {items.length}</Text>
          <Text style={s.itemName}>{item.name || `Item ${i + 1}`}</Text>
          <View style={s.body}>
            <View style={s.imageBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              {item.imageUrl ? <Image src={item.imageUrl} style={s.image} /> : <Text style={s.muted}>No image</Text>}
            </View>
            <View style={s.specs}>
              {item.description.trim() ? (
                <View style={s.specRow}>
                  <Text style={s.specLabel}>Description</Text>
                  <Text style={s.specValue}>{item.description}</Text>
                </View>
              ) : null}
              {item.category.trim() ? (
                <View style={s.specRow}>
                  <Text style={s.specLabel}>Category</Text>
                  <Text style={s.specValue}>{item.category}</Text>
                </View>
              ) : null}
              {item.quantity.trim() ? (
                <View style={s.specRow}>
                  <Text style={s.specLabel}>Quantity</Text>
                  <Text style={s.specValue}>{item.quantity}{item.unit.trim() ? ` ${item.unit}` : ''}</Text>
                </View>
              ) : null}
              {dims(item) ? (
                <View style={s.specRow}>
                  <Text style={s.specLabel}>Dimensions</Text>
                  <Text style={s.specValue}>{dims(item)}</Text>
                </View>
              ) : null}

              {item.materials.length > 0 ? (
                <>
                  <Text style={s.sectionHead}>Materials</Text>
                  {item.materials.map((m, j) => (
                    <View key={j} style={s.specRow}>
                      <Text style={s.specLabel}>{m.type || 'Material'}</Text>
                      <Text style={s.specValue}>
                        {[m.description, m.colour, m.supplierName ? `via ${m.supplierName}` : '']
                          .filter(v => v && v.trim())
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {item.notes.trim() ? (
                <>
                  <Text style={s.sectionHead}>Notes</Text>
                  <Text style={s.notes}>{item.notes}</Text>
                </>
              ) : null}

              <View style={s.priceBox}>
                <Text style={[s.sectionHead, { marginTop: 0 }]}>For supplier completion</Text>
                <View style={s.priceLine}>
                  <Text style={s.muted}>Unit price (excl. VAT)</Text>
                  <Text>R ____________</Text>
                </View>
                <View style={s.priceLine}>
                  <Text style={s.muted}>Lead time</Text>
                  <Text>____________</Text>
                </View>
                <View style={[s.priceLine, { borderBottomWidth: 0 }]}>
                  <Text style={s.muted}>Valid until</Text>
                  <Text>____________</Text>
                </View>
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
