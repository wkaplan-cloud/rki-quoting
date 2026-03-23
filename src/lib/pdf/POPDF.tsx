import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { styles } from './styles'
import { formatZAR } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

interface Props {
  project: Project
  lineItems: LineItem[]
  suppliers: Supplier[]
  supplierId?: string
  vatRate?: number
  logoUrl?: string | null
  businessName?: string | null
}

function POPage({ project, items, supplier, vatRate = 15, logoUrl, businessName }: { project: Project; items: LineItem[]; supplier: Supplier | null; vatRate?: number; logoUrl?: string | null; businessName?: string | null }) {
  const itemRows = items.filter(i => i.row_type !== 'section')
  const subtotal = itemRows.reduce((sum, i) => sum + i.cost_price * i.quantity, 0)
  const vatAmount = subtotal * (vatRate / 100)
  const grandTotal = subtotal + vatAmount
  const poNumber = `${project.project_number}-${supplier?.supplier_name.slice(0, 3).toUpperCase() ?? 'GEN'}`

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ justifyContent: 'center' }}>
          {logoUrl
            ? <Image src={logoUrl} style={{ height: 48, maxWidth: 160, objectFit: 'contain' }} />
            : <Text style={styles.brandName}>{businessName ?? 'R Kaplan Interiors'}</Text>
          }
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.docTitle}>PURCHASE ORDER</Text>
          <Text style={styles.docMeta}>{poNumber}</Text>
          <Text style={styles.docMeta}>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>

      {/* Supplier details */}
      {supplier && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPLIER</Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>{supplier.supplier_name}</Text>
            {supplier.contact_person && <Text style={[styles.infoVal, { marginBottom: 2 }]}>{supplier.contact_person}</Text>}
            {supplier.email && <Text style={styles.infoVal}>{supplier.email}</Text>}
          </View>
        </View>
      )}

      {/* Project ref */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PROJECT REFERENCE</Text>
        <Text style={styles.infoVal}>{project.project_name} ({project.project_number})</Text>
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ITEMS TO ORDER</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>ITEM</Text>
            <Text style={[styles.th, { flex: 3 }]}>DESCRIPTION</Text>
            <Text style={[styles.th, { flex: 2 }]}>DELIVER TO</Text>
            <Text style={[styles.th, { width: 44, textAlign: 'right', paddingRight: 8 }]}>QTY</Text>
            <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>COST</Text>
            <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>TOTAL</Text>
          </View>
          {items.map((item, i) => {
            if (item.row_type === 'section') {
              return (
                <View key={item.id} style={styles.tableSectionRow}>
                  <Text style={styles.tableSectionLabel}>{(item.item_name || 'Section').toUpperCase()}</Text>
                </View>
              )
            }
            return (
              <View key={item.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.td, { flex: 2, paddingLeft: item.indent_level > 0 ? 8 : 0 }]}>{item.item_name}</Text>
                <Text style={[styles.td, styles.tdMuted, { flex: 3 }]}>{item.description ?? ''}</Text>
                <Text style={[styles.td, styles.tdMuted, { flex: 2 }]}>{item.delivery_address ?? ''}</Text>
                <Text style={[styles.td, { width: 44, textAlign: 'right', paddingRight: 8 }]}>{item.quantity}</Text>
                <Text style={[styles.td, { width: 72, textAlign: 'right' }]}>{formatZAR(item.cost_price)}</Text>
                <Text style={[styles.td, { width: 72, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(item.cost_price * item.quantity)}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* PO Total */}
      <View style={styles.totalsContainer}>
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsVal}>{formatZAR(subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>VAT ({vatRate}%)</Text>
            <Text style={styles.totalsVal}>{formatZAR(vatAmount)}</Text>
          </View>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsBig}>
            <Text style={styles.totalsBigLabel}>TOTAL COST</Text>
            <Text style={styles.totalsBigVal}>{formatZAR(grandTotal)}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Please reference PO number {poNumber} on all correspondence and delivery notes.</Text>
        <View style={styles.footerSig}>
          <View style={styles.sigLine}><Text>Authorised Signature</Text></View>
        </View>
      </View>
    </Page>
  )
}

export function POPDF({ project, lineItems, suppliers, supplierId, vatRate = 15, logoUrl, businessName }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))

  // Single supplier mode — lineItems already filtered by API
  if (supplierId) {
    const supplier = supplierMap[supplierId] ?? null
    return (
      <Document>
        <POPage project={project} items={lineItems} supplier={supplier} vatRate={vatRate} logoUrl={logoUrl} businessName={businessName} />
      </Document>
    )
  }

  // All suppliers mode — group by supplier
  const grouped = lineItems.reduce<Record<string, LineItem[]>>((acc, item) => {
    const key = item.supplier_id ?? '__none__'
    if (!acc[key]) acc[key] = []
    acc[key]!.push(item)
    return acc
  }, {})

  return (
    <Document>
      {Object.entries(grouped).map(([sid, items]) => {
        const supplier = sid !== '__none__' ? (supplierMap[sid] ?? null) : null
        return <POPage key={sid} project={project} items={items} supplier={supplier} vatRate={vatRate} logoUrl={logoUrl} businessName={businessName} />
      })}
    </Document>
  )
}
