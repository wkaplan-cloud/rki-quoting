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
  businessAddress?: string | null
  vatNumber?: string | null
  companyReg?: string | null
  printDate?: string | null
}

function POPage({ project, items, supplier, vatRate = 15, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate }: { project: Project; items: LineItem[]; supplier: Supplier | null; vatRate?: number; logoUrl?: string | null; businessName?: string | null; businessAddress?: string | null; vatNumber?: string | null; companyReg?: string | null; printDate?: string | null }) {
  const itemRows = items.filter(i => i.row_type !== 'section')
  const subtotal = itemRows.reduce((sum, i) => sum + i.cost_price * i.quantity, 0)
  const vatAmount = subtotal * (vatRate / 100)
  const grandTotal = subtotal + vatAmount
  const poNumber = `${project.project_number}-${supplier?.supplier_name.slice(0, 3).toUpperCase() ?? 'GEN'}`

  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {logoUrl
            ? <Image src={logoUrl} style={{ maxWidth: 300, objectFit: 'contain', marginBottom: 8 }} />
            : <Text style={[styles.brandName, { marginBottom: 8 }]}>{businessName || 'R Kaplan Interiors'}</Text>
          }
          {businessAddress ? (
            <Text style={{ fontSize: 7, color: '#8A877F', marginBottom: 3, lineHeight: 1.4 }}>
              {businessAddress.replace(/\n/g, ', ')}
            </Text>
          ) : null}
          {(vatNumber || companyReg) ? (
            <Text style={{ fontSize: 7, color: '#8A877F' }}>
              {[vatNumber ? `VAT: ${vatNumber}` : null, companyReg ? `Reg: ${companyReg}` : null].filter(Boolean).join('  ·  ')}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <Text style={styles.docTitle}>PURCHASE ORDER</Text>
          <Text style={styles.docMeta}>{poNumber}</Text>
          <Text style={styles.docMeta}>{new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
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
            <Text style={[styles.th, { width: 36, textAlign: 'right', paddingRight: 4 }]}>LEAD</Text>
            <Text style={[styles.th, { width: 52, textAlign: 'right', paddingRight: 8 }]}>QTY</Text>
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
                <View style={[{ flex: 2, paddingLeft: item.indent_level > 0 ? 8 : 0 }]}>
                  <Text style={styles.td}>{item.item_name}</Text>
                  {(item.dimensions || item.colour_finish) ? (
                    <Text style={[styles.td, styles.tdMuted, { fontSize: 6, marginTop: 1 }]}>
                      {[item.dimensions, item.colour_finish].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.td, styles.tdMuted, { flex: 3, paddingLeft: 6, paddingRight: 8 }]}>{item.description ?? ''}</Text>
                <Text style={[styles.td, styles.tdMuted, { flex: 2 }]}>{item.delivery_address ?? ''}</Text>
                <Text style={[styles.td, styles.tdMuted, { width: 36, textAlign: 'right', paddingRight: 4 }]}>{item.lead_time_weeks ? `${item.lead_time_weeks}w` : ''}</Text>
                <Text style={[styles.td, { width: 52, textAlign: 'right', paddingRight: 8 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
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
        <Text style={[styles.footerText, { textAlign: 'left' }]}>Please reference PO number {poNumber} on all correspondence and delivery notes.</Text>
      </View>
    </Page>
  )
}

export function POPDF({ project, lineItems, suppliers, supplierId, vatRate = 15, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))
  const pageProps = { vatRate, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate }

  // Single supplier mode — lineItems already filtered by API
  if (supplierId) {
    const supplier = supplierMap[supplierId] ?? null
    return (
      <Document>
        <POPage project={project} items={lineItems} supplier={supplier} {...pageProps} />
      </Document>
    )
  }

  // All suppliers mode — one page per supplier with section inheritance
  const supplierIds = [...new Set(
    lineItems.filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
  )]

  return (
    <Document>
      {supplierIds.map(sid => {
        const supplier = supplierMap[sid] ?? null
        const result: LineItem[] = []
        let pendingSection: LineItem | null = null
        for (const item of lineItems) {
          if (item.row_type === 'section') { pendingSection = item }
          else if (item.supplier_id === sid) {
            if (pendingSection) { result.push(pendingSection); pendingSection = null }
            result.push(item)
          }
        }
        return <POPage key={sid} project={project} items={result} supplier={supplier} {...pageProps} />
      })}
    </Document>
  )
}
