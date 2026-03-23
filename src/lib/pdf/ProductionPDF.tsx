import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import { computeLineItem, formatZAR, computeTotals } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7, color: '#2C2C2A', padding: 32, flexDirection: 'column' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#D8D3C8' },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  meta: { fontSize: 7, color: '#8A877F', marginTop: 2 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#2C2C2A', paddingVertical: 5, paddingHorizontal: 3 },
  th: { fontSize: 6, color: '#F5F2EC', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  rowAlt: { backgroundColor: '#FDFCF9' },
  sectionRow: { flexDirection: 'row', backgroundColor: '#F5F2EC', paddingVertical: 5, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', marginTop: 3 },
  sectionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#5A5750', textTransform: 'uppercase', letterSpacing: 0.8 },
  td: { fontSize: 6.5, color: '#2C2C2A' },
  tdMuted: { color: '#8A877F' },
  // Totals
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalsLabel: { fontSize: 7, color: '#8A877F' },
  totalsVal: { fontSize: 7, color: '#2C2C2A' },
  totalsBig: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  totalsBigLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  totalsBigVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  divider: { borderTopWidth: 0.5, borderTopColor: '#D8D3C8', marginVertical: 4 },
})

// Column widths
const W = {
  item:     130,
  desc:     165,
  qty:      28,
  supplier: 60,
  deliver:  60,
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
}

export function ProductionPDF({ project, lineItems, suppliers, logoUrl, businessName, vatRate = 15 }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.supplier_name]))
  const totals = computeTotals(lineItems, project.design_fee, vatRate)
  let itemIndex = 0

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 160, maxHeight: 36, objectFit: 'contain' }} />
              : <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{businessName || 'R Kaplan Interiors'}</Text>
            }
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.title}>PRODUCTION SHEET</Text>
            <Text style={s.meta}>{project.project_name}  ·  {project.project_number}</Text>
            <Text style={s.meta}>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.meta}>Total (incl. VAT)</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1A1A18', marginTop: 2 }}>{formatZAR(totals.grand_total)}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.th, { width: W.item }]}>Item</Text>
          <Text style={[s.th, { width: W.desc }]}>Description</Text>
          <Text style={[s.th, { width: W.qty, textAlign: 'right' }]}>Qty</Text>
          <Text style={[s.th, { width: W.supplier }]}>Supplier</Text>
          <Text style={[s.th, { width: W.deliver }]}>Deliver To</Text>
          <Text style={[s.th, { width: W.cost, textAlign: 'right' }]}>Cost</Text>
          <Text style={[s.th, { width: W.mkup, textAlign: 'right' }]}>Mkup%</Text>
          <Text style={[s.th, { width: W.sale, textAlign: 'right' }]}>Sale</Text>
          <Text style={[s.th, { width: W.profit, textAlign: 'right' }]}>Profit</Text>
          <Text style={[s.th, { width: W.totCost, textAlign: 'right' }]}>Tot. Cost</Text>
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
              <Text style={[s.td, { width: W.item, paddingLeft: item.indent_level > 0 ? 6 : 0 }]}>{item.item_name}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.desc }]}>{item.description ?? ''}</Text>
              <Text style={[s.td, { width: W.qty, textAlign: 'right' }]}>{item.quantity}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.supplier }]}>{supplierMap[item.supplier_id ?? ''] ?? ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.deliver }]}>{item.delivery_address ?? ''}</Text>
              <Text style={[s.td, { width: W.cost, textAlign: 'right' }]}>{formatZAR(item.cost_price)}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.mkup, textAlign: 'right' }]}>{item.markup_percentage}%</Text>
              <Text style={[s.td, { width: W.sale, textAlign: 'right' }]}>{formatZAR(c.sale_price)}</Text>
              <Text style={[s.td, { width: W.profit, textAlign: 'right', color: c.profit >= 0 ? '#15803d' : '#dc2626' }]}>{formatZAR(c.profit)}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.totCost, textAlign: 'right' }]}>{formatZAR(c.total_cost)}</Text>
              <Text style={[s.td, { width: W.totPrice, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(c.total_price)}</Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
          <View style={{ width: 220, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 10 }}>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>Subtotal</Text><Text style={s.totalsVal}>{formatZAR(totals.subtotal)}</Text></View>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>Design Fee ({project.design_fee ?? 0}%)</Text><Text style={s.totalsVal}>{formatZAR(totals.design_fee)}</Text></View>
            <View style={s.totalsRow}><Text style={s.totalsLabel}>VAT ({vatRate}%)</Text><Text style={s.totalsVal}>{formatZAR(totals.vat_amount)}</Text></View>
            <View style={s.divider} />
            <View style={s.totalsBig}><Text style={s.totalsBigLabel}>TOTAL</Text><Text style={s.totalsBigVal}>{formatZAR(totals.grand_total)}</Text></View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
