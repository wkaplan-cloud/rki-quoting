import { Document, Page, Text, View } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import type { Project, LineItem, Supplier } from '../types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 7, color: '#2C2C2A', padding: 32, flexDirection: 'column' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#D8D3C8' },
  studioName: { fontSize: 11, color: '#2C2C2A', fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  docTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1A1A18' },
  projectName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1A1A18', textAlign: 'right' },
  meta: { fontSize: 7, color: '#8A877F', marginTop: 3, textAlign: 'right' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#2C2C2A', paddingVertical: 6, paddingHorizontal: 3 },
  th: { fontSize: 9, color: '#F5F2EC', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  row: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#EDE9E1' },
  rowAlt: { backgroundColor: '#F5F2EC' },
  sectionRow: { flexDirection: 'row', backgroundColor: '#D8D3C8', paddingVertical: 5, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: '#C4BFB5', marginTop: 4 },
  sectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4A4845', textTransform: 'uppercase', letterSpacing: 0.8 },
  td: { fontSize: 9, color: '#2C2C2A' },
  tdMuted: { color: '#8A877F' },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#D8D3C8', paddingTop: 6 },
  footerText: { fontSize: 7, color: '#8A877F' },
})

// Portrait A4 usable width: 595 - 64 = 531
const W = {
  num:      24,
  item:     130,
  desc:     200,
  qty:      40,
  supplier: 137,
}

function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface Props {
  project: Project
  lineItems: LineItem[]
  suppliers: Supplier[]
  businessName?: string | null
  printDate?: string | null
  assignedTo?: string | null
}

export function InstallationSheetPDF({ project, lineItems, suppliers, businessName, printDate, assignedTo }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.supplier_name]))
  const clientName = (() => {
    const c = (project as any).client
    if (!c) return null
    if (Array.isArray(c)) return c[0]?.client_name ?? null
    return c.client_name ?? null
  })()
  const printedOn = new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  let itemNum = 0

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.studioName}>{businessName || 'R Kaplan Interiors'}</Text>
            <Text style={s.docTitle}>INSTALLATION SHEET</Text>
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
          <Text style={[s.th, { width: W.num, textAlign: 'right', paddingRight: 4 }]}>#</Text>
          <Text style={[s.th, { width: W.item, paddingRight: 3 }]}>Item</Text>
          <Text style={[s.th, { width: W.desc, paddingRight: 3 }]}>Description</Text>
          <Text style={[s.th, { width: W.qty, textAlign: 'right', paddingRight: 4 }]}>Qty</Text>
          <Text style={[s.th, { width: W.supplier }]}>Supplier</Text>
        </View>

        {/* Rows */}
        {lineItems.map((item, idx) => {
          if (item.row_type === 'section') {
            return (
              <View key={item.id} style={s.sectionRow}>
                <Text style={s.sectionLabel}>{(item.item_name || 'Section').toUpperCase()}</Text>
              </View>
            )
          }
          itemNum++
          const isLinked = !!item.parent_item_id
          return (
            <View key={item.id} style={s.row}>
              <Text style={[s.td, s.tdMuted, { width: W.num, textAlign: 'right', paddingRight: 4, fontSize: 6.5 }]}>{itemNum}.</Text>
              <View style={{ width: W.item, paddingRight: 3, paddingLeft: isLinked ? 6 : 0 }}>
                <Text style={s.td}>{cap(item.item_name)}</Text>
                {(item.dimensions || item.colour_finish) ? (
                  <Text style={[s.td, s.tdMuted, { fontSize: 7, marginTop: 1 }]}>
                    {[item.dimensions, item.colour_finish].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Text style={[s.td, s.tdMuted, { width: W.desc, paddingRight: 3 }]}>{item.description ?? ''}</Text>
              <Text style={[s.td, { width: W.qty, textAlign: 'right', paddingRight: 4 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
              <Text style={[s.td, s.tdMuted, { width: W.supplier }]}>{supplierMap[item.supplier_id ?? ''] ?? ''}</Text>
            </View>
          )
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{businessName || 'R Kaplan Interiors'}  ·  {project.project_number}  ·  Printed {printedOn}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
