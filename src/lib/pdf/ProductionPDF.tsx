import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { computeLineItem, computeLineItems, formatZAR, computeTotals } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7, color: '#2C2C2A', padding: 32, flexDirection: 'column' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#D8D3C8' },
  studioName: { fontSize: 11, color: '#2C2C2A', fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  projectName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A18', textAlign: 'right' },
  meta: { fontSize: 7, color: '#8A877F', marginTop: 3, textAlign: 'right' },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#2C2C2A', paddingVertical: 6, paddingHorizontal: 3 },
  th: { fontSize: 9, color: '#F5F2EC', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  rowAlt: { backgroundColor: '#F5F2EC' },
  rowLinked: { borderLeftWidth: 3, borderLeftColor: '#C4A46B' },
  sectionRow: { flexDirection: 'row', backgroundColor: '#D8D3C8', paddingVertical: 5, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#C4BFB5', marginTop: 4 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4A4845', textTransform: 'uppercase', letterSpacing: 0.8 },
  td: { fontSize: 9, color: '#2C2C2A' },
  tdMuted: { color: '#8A877F' },
  // Totals
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalsLabel: { fontSize: 8, color: '#8A877F' },
  totalsVal: { fontSize: 8, color: '#2C2C2A' },
  totalsBig: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  totalsBigLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  totalsBigVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  divider: { borderTopWidth: 0.5, borderTopColor: '#D8D3C8', marginVertical: 5 },
  // Footer
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#D8D3C8', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#8A877F' },
})

// Column widths (landscape A4 usable ~778px)
// Monetary columns widened so "R 50 000,00" never wraps
const W = {
  num:      20,
  img:      0,
  item:     112,
  desc:     138,
  qty:      36,
  supplier: 56,
  deliver:  56,
  lead:     32,
  cost:     62,
  mkup:     34,
  sale:     62,
  profit:   60,
  totCost:  62,
  totPrice: 64,
}
// Total: 20+112+138+36+56+56+32+62+34+62+60+62+64 = 794 — fits A4 landscape (842-32*2=778 usable)
// (react-pdf auto-clamps overflow in flex layout)

// Same sheet with a thumbnail column. The 46pt it needs comes out of the text
// columns only — the monetary ones keep their width so "R 50 000,00" still
// never wraps. Used only when the project actually has images to show, so a
// sheet without them is laid out exactly as before.
const W_WITH_IMAGES = { ...W, img: 46, item: 96, desc: 108, supplier: 50, deliver: 50, lead: 28 }

/** 1.5 cm, matching the quote and invoice thumbnails (react-pdf units are pt). */
const THUMB = 42.5

function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Returns just the first line of a delivery address (the location/supplier name)
function deliverToName(address: string | null | undefined): string {
  if (!address) return ''
  return address.split('\n')[0].trim()
}

interface Props {
  project: Project
  lineItems: LineItem[]
  suppliers: Supplier[]
  logoUrl?: string | null
  businessName?: string | null
  vatRate?: number
  printDate?: string | null
  assignedTo?: string | null
  /** Line item id → base64 image, from fetchLineItemImages. Empty when off. */
  images?: Record<string, string>
}

export function ProductionPDF({ project, lineItems, suppliers, businessName, vatRate = 15, printDate, assignedTo, images = {} }: Props) {
  const showImages = Object.keys(images).length > 0
  const w = showImages ? W_WITH_IMAGES : W
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.supplier_name]))
  const totals = computeTotals(lineItems, project.design_fee, vatRate)
  const grossProfit = computeLineItems(lineItems).reduce((sum, i) => sum + i.profit, 0) + totals.design_fee
  const clientName = (() => {
    const c = (project as { client?: { client_name?: string | null } | { client_name?: string | null }[] | null }).client
    if (!c) return null
    if (Array.isArray(c)) return c[0]?.client_name ?? null
    return c.client_name ?? null
  })()
  const printedOn = new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  let itemIndex = 0
  let itemNum = 0

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.studioName}>{businessName || 'R Kaplan Interiors'}</Text>
            <Text style={s.docTitle}>JOB COST SHEET</Text>
          </View>
          <View>
            <Text style={s.projectName}>{project.project_name}</Text>
            <Text style={s.meta}>{project.project_number}{clientName ? `  ·  ${clientName}` : ''}</Text>
            {assignedTo && <Text style={s.meta}>Assigned to: {assignedTo}</Text>}
            <Text style={s.meta}>{printedOn}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.th, { width: w.num, textAlign: 'right', paddingRight: 4 }]}>#</Text>
          {showImages && <Text style={[s.th, { width: w.img, paddingLeft: 3, paddingRight: 3 }]}>Image</Text>}
          <Text style={[s.th, { width: w.item, paddingRight: 3 }]}>Item</Text>
          <Text style={[s.th, { width: w.desc, paddingRight: 3 }]}>Description</Text>
          <Text style={[s.th, { width: w.qty, textAlign: 'right', paddingRight: 4 }]}>Qty</Text>
          <Text style={[s.th, { width: w.supplier, paddingRight: 3 }]}>Supplier</Text>
          <Text style={[s.th, { width: w.deliver, paddingRight: 3 }]}>Del. To</Text>
          <Text style={[s.th, { width: w.lead, textAlign: 'right', paddingRight: 4 }]}>Lead</Text>
          <Text style={[s.th, { width: w.cost, textAlign: 'right', paddingRight: 4 }]}>Cost</Text>
          <Text style={[s.th, { width: w.mkup, textAlign: 'right', paddingRight: 4 }]}>Markup</Text>
          <Text style={[s.th, { width: w.sale, textAlign: 'right', paddingRight: 4 }]}>Sale</Text>
          <Text style={[s.th, { width: w.profit, textAlign: 'right', paddingRight: 4 }]}>Profit</Text>
          <Text style={[s.th, { width: w.totCost, textAlign: 'right', paddingRight: 4 }]}>Tot. Cost</Text>
          <Text style={[s.th, { width: w.totPrice, textAlign: 'right' }]}>Tot. Price</Text>
        </View>

        {/* Rows */}
        {lineItems.map(item => {
          if (item.row_type === 'section') {
            return (
              <View key={item.id} style={s.sectionRow}>
                <Text style={s.sectionLabel}>{(item.item_name || 'Section').toUpperCase()}</Text>
              </View>
            )
          }
          const c = computeLineItem(item)
          itemIndex++
          itemNum++
          const isLinked = !!item.parent_item_id
          return (
            <View key={item.id} style={[s.row, isLinked ? s.rowLinked : {}]}>
              <Text style={[s.td, s.tdMuted, { width: w.num, textAlign: 'right', paddingRight: 4, fontSize: 6.5 }]}>{itemNum}.</Text>
              {showImages && (
                <View style={{ width: w.img, paddingLeft: 3, paddingRight: 3 }}>
                  {images[item.id]
                    ? <Image src={images[item.id]} style={{ width: THUMB, height: THUMB, borderRadius: 2, objectFit: 'cover' }} />
                    : null}
                </View>
              )}
              <View style={{ width: w.item, paddingRight: 3, paddingLeft: isLinked ? 4 : 0 }}>
                <Text style={s.td}>{cap(item.item_name)}</Text>
                {(item.dimensions || item.colour_finish) ? (
                  <Text style={[s.td, s.tdMuted, { fontSize: 7, marginTop: 1 }]}>
                    {[item.dimensions, item.colour_finish].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.td, s.tdMuted, { width: w.desc, paddingRight: 3 }]}>{item.description ?? ''}</Text>
              <Text style={[s.td, { width: w.qty, textAlign: 'right', paddingRight: 4 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: w.supplier, paddingRight: 3 }]}>{supplierMap[item.supplier_id ?? ''] ?? ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: w.deliver, paddingRight: 3 }]}>{deliverToName(item.delivery_address)}</Text>
              <Text style={[s.td, s.tdMuted, { width: w.lead, textAlign: 'right', paddingRight: 4 }]}>{item.lead_time_days != null ? `${item.lead_time_days}d` : item.lead_time_weeks ? `${item.lead_time_weeks}w` : ''}</Text>
              <Text style={[s.td, { width: w.cost, textAlign: 'right', paddingRight: 4 }]}>{formatZAR(item.cost_price)}</Text>
              <Text style={[s.td, s.tdMuted, { width: w.mkup, textAlign: 'right', paddingRight: 4 }]}>{item.markup_percentage}%</Text>
              <Text style={[s.td, { width: w.sale, textAlign: 'right', paddingRight: 4 }]}>{formatZAR(c.sale_price)}</Text>
              <Text style={[s.td, { width: w.profit, textAlign: 'right', paddingRight: 4, color: c.profit >= 0 ? '#15803d' : '#dc2626' }]}>{formatZAR(c.profit)}</Text>
              <Text style={[s.td, s.tdMuted, { width: w.totCost, textAlign: 'right', paddingRight: 4 }]}>{formatZAR(c.total_cost)}</Text>
              <Text style={[s.td, { width: w.totPrice, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(c.total_price)}</Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={{ marginTop: 16, marginBottom: 40, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          {/* Gross profit box */}
          <View style={{ width: 160, borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 12, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 7, color: '#16a34a', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Gross Profit</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: grossProfit >= 0 ? '#15803d' : '#dc2626' }}>{formatZAR(grossProfit)}</Text>
            <Text style={{ fontSize: 6.5, color: '#4ade80', marginTop: 4 }}>excl. VAT</Text>
          </View>
          <View style={{ width: 240, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12 }}>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>Subtotal</Text><Text style={s.totalsVal}>{formatZAR(totals.subtotal)}</Text></View>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>Design Fee ({project.design_fee ?? 0}%)</Text><Text style={s.totalsVal}>{formatZAR(totals.design_fee)}</Text></View>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>VAT ({vatRate}%)</Text><Text style={s.totalsVal}>{formatZAR(totals.vat_amount)}</Text></View>
            <View style={s.divider} />
            <View style={s.totalsBig}><Text style={s.totalsBigLabel}>TOTAL</Text><Text style={s.totalsBigVal}>{formatZAR(totals.grand_total)}</Text></View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{businessName || 'R Kaplan Interiors'}  ·  {project.project_number}  ·  Printed {printedOn}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
