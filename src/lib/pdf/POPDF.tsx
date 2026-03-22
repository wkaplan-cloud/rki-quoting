import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import { formatZAR } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

interface Props {
  project: Project
  lineItems: LineItem[]
  suppliers: Supplier[]
}

export function POPDF({ project, lineItems, suppliers }: Props) {
  // Group line items by supplier
  const grouped = lineItems.reduce<Record<string, LineItem[]>>((acc, item) => {
    const key = item.supplier_id ?? '__none__'
    if (!acc[key]) acc[key] = []
    acc[key]!.push(item)
    return acc
  }, {})

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))

  return (
    <Document>
      {Object.entries(grouped).map(([supplierId, items]) => {
        const supplier = supplierId !== '__none__' ? supplierMap[supplierId] : null
        const total = items.reduce((sum, i) => sum + i.cost_price * i.quantity, 0)
        const poNumber = `${project.project_number}-${supplier?.supplier_name.slice(0, 3).toUpperCase() ?? 'GEN'}`

        return (
          <Page key={supplierId} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.brandName}>R Kaplan Interiors</Text>
                <Text style={styles.brandSub}>INTERIOR DESIGN</Text>
              </View>
              <View>
                <Text style={styles.docTitle}>PURCHASE ORDER</Text>
                <Text style={styles.docMeta}>{poNumber}</Text>
                <Text style={styles.docMeta}>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              </View>
            </View>

            {/* Supplier details */}
            {supplier && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Supplier</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoBlock}>
                    <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{supplier.supplier_name}</Text>
                    {supplier.contact_person && <Text style={styles.infoVal}>{supplier.contact_person}</Text>}
                    {supplier.email && <Text style={styles.infoVal}>{supplier.email}</Text>}
                  </View>
                  <View style={styles.infoBlock}>
                    {supplier.delivery_address && (
                      <>
                        <Text style={styles.infoKey}>Delivery Address</Text>
                        <Text style={styles.infoVal}>{supplier.delivery_address}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Project ref */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Project Reference</Text>
              <Text style={styles.infoVal}>{project.project_name} ({project.project_number})</Text>
            </View>

            {/* Items */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Items to Order</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 2 }]}>Item</Text>
                  <Text style={[styles.th, { flex: 3 }]}>Description</Text>
                  <Text style={[styles.th, { width: 40, textAlign: 'right' }]}>Qty</Text>
                  <Text style={[styles.th, { width: 80, textAlign: 'right' }]}>Cost Price</Text>
                  <Text style={[styles.th, { width: 80, textAlign: 'right' }]}>Total Cost</Text>
                </View>
                {items.map((item, i) => (
                  <View key={item.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.td, { flex: 2 }]}>{item.item_name}</Text>
                    <Text style={[styles.td, styles.tdMuted, { flex: 3 }]}>{item.description ?? ''}</Text>
                    <Text style={[styles.td, { width: 40, textAlign: 'right' }]}>{item.quantity}</Text>
                    <Text style={[styles.td, { width: 80, textAlign: 'right' }]}>{formatZAR(item.cost_price)}</Text>
                    <Text style={[styles.td, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(item.cost_price * item.quantity)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* PO Total */}
            <View style={styles.totalsContainer}>
              <View style={styles.totalsBox}>
                <View style={styles.totalsBig}>
                  <Text style={styles.totalsBigLabel}>TOTAL COST</Text>
                  <Text style={styles.totalsBigVal}>{formatZAR(total)}</Text>
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
      })}
    </Document>
  )
}
