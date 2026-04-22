import { Document, Page, Text, View } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { computeLineItem, formatZAR, computeTotals } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7, color: '#2C2C2A', padding: 32, flexDirection: 'column' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#D8D3C8' },
  studioName: { fontSize: 7, color: '#8A877F', marginBottom: 4 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  projectName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A18', textAlign: 'right' },
  meta: { fontSize: 7, color: '#8A877F', marginTop: 3, textAlign: 'right' },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#2C2C2A', paddingVertical: 6, paddingHorizontal: 3 },
  th: { fontSize: 9, color: '#F5F2EC', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  rowAlt: { backgroundColor: '#F5F2EC' },
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
const W = {
  item:     130,
  desc:     150,
  qty:      40,
  lead:     36,
  supplier: 60,
  deliver:  54,
  cost:     52,
  mkup:     36,
  sale:     52,
  profit:   52,
  totCost:  56,
  totPrice: 60,
}

interface Props {
  project: Project
  lineItems: LineItem[]
  suppliers: Supplier[]
  logoUrl?: string | null
  businessName?: string | null
  vatRate?: number
  printDate?: string | null
}

export function ProductionPDF({ project, lineItems, suppliers, businessName, vatRate = 15, printDate }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.supplier_name]))
  const totals = computeTotals(lineItems, project.design_fee, vatRate)
  const clientName = (() => {
    const c = (project as any).client
    if (!c) return null
    if (Array.isArray(c)) return c[0]?.client_name ?? null
    return c.client_name ?? null
  })()
  const printedOn = new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  let itemIndex = 0

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.studioName}>{businessName || 'R Kaplan Interiors'}</Text>
            <Text style={s.docTitle}>PRODUCTION SHEET</Text>
          </View>
          <View>
            <Text style={s.projectName}>{project.project_name}</Text>
            <Text style={s.meta}>{project.project_number}{clientName ? `  ·  ${clientName}` : ''}</Text>
            <Text style={s.meta}>{printedOn}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.th, { width: W.item, paddingRight: 6 }]}>Item</Text>
          <Text style={[s.th, { width: W.desc, paddingRight: 6 }]}>Description</Text>
          <Text style={[s.th, { width: W.qty, textAlign: 'right', paddingRight: 6 }]}>Qty / Unit</Text>
          <Text style={[s.th, { width: W.supplier, paddingRight: 6 }]}>Supplier</Text>
          <Text style={[s.th, { width: W.deliver, paddingRight: 6 }]}>Deliver To</Text>
          <Text style={[s.th, { width: W.lead, textAlign: 'right', paddingRight: 6 }]}>Lead</Text>
          <Text style={[s.th, { width: W.cost, textAlign: 'right', paddingRight: 6 }]}>Cost</Text>
          <Text style={[s.th, { width: W.mkup, textAlign: 'right', paddingRight: 6 }]}>Mkup%</Text>
          <Text style={[s.th, { width: W.sale, textAlign: 'right', paddingRight: 6 }]}>Sale</Text>
          <Text style={[s.th, { width: W.profit, textAlign: 'right', paddingRight: 6 }]}>Profit</Text>
          <Text style={[s.th, { width: W.totCost, textAlign: 'right', paddingRight: 6 }]}>Tot. Cost</Text>
          <Text style={[s.th, { width: W.totPrice, textAlign: 'right' }]}>Tot. Price</Text>
        </View>

        {/* Rows */}
        {lineItems.map(item => {
          if (item.row_type === 'section') {
            return (
              <View key={item.id} style={s.sectionRow}>
                <Text style={s.sectionLabel}>{item.item_name || 'Section'}</Text>
              </View>
            )
          }
          const c = computeLineItem(item)
          const alt = itemIndex++ % 2 === 1
          return (
            <View key={item.id} style={[s.row, alt ? s.rowAlt : {}]}>
              <View style={[{ width: W.item, paddingRight: 6, paddingLeft: item.indent_level > 0 ? 6 : 0 }]}>
                <Text style={s.td}>{item.item_name}</Text>
                {(item.dimensions || item.colour_finish) ? (
                  <Text style={[s.td, s.tdMuted, { fontSize: 7, marginTop: 1 }]}>
                    {[item.dimensions, item.colour_finish].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.td, s.tdMuted, { width: W.desc, paddingRight: 6 }]}>{item.description ?? ''}</Text>
              <Text style={[s.td, { width: W.qty, textAlign: 'right', paddingRight: 6 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.supplier, paddingRight: 6 }]}>{supplierMap[item.supplier_id ?? ''] ?? ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.deliver, paddingRight: 6 }]}>{item.delivery_address ?? ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.lead, textAlign: 'right', paddingRight: 6 }]}>{item.lead_time_weeks ? `${item.lead_time_weeks}w` : ''}</Text>
              <Text style={[s.td, { width: W.cost, textAlign: 'right', paddingRight: 6 }]}>{formatZAR(item.cost_price)}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.mkup, textAlign: 'right', paddingRight: 6 }]}>{item.markup_percentage}%</Text>
              <Text style={[s.td, { width: W.sale, textAlign: 'right', paddingRight: 6 }]}>{formatZAR(c.sale_price)}</Text>
              <Text style={[s.td, { width: W.profit, textAlign: 'right', paddingRight: 6, color: c.profit >= 0 ? '#15803d' : '#dc2626' }]}>{formatZAR(c.profit)}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.totCost, textAlign: 'right', paddingRight: 6 }]}>{formatZAR(c.total_cost)}</Text>
              <Text style={[s.td, { width: W.totPrice, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(c.total_price)}</Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={{ marginTop: 16, marginBottom: 40, alignItems: 'flex-end' }}>
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
