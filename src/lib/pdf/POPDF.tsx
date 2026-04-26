import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { styles } from './styles'
import { formatZAR } from '../quoting'
import type { Project, LineItem, Supplier } from '../types'

interface Props {
  project: Project
  lineItems: LineItem[]
  allLineItems?: LineItem[]
  suppliers: Supplier[]
  supplierId?: string
  vatRate?: number
  logoUrl?: string | null
  businessName?: string | null
  businessAddress?: string | null
  vatNumber?: string | null
  companyReg?: string | null
  printDate?: string | null
  platformContacts?: { supplier_id: string; email: string | null; rep_name?: string | null }[]
}

function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function DeliverToCell({ deliveryAddress, allSuppliers, businessName, businessAddress }: { deliveryAddress: string | null; allSuppliers: Supplier[]; businessName?: string | null; businessAddress?: string | null }) {
  if (!deliveryAddress && businessName && businessAddress) {
    return (
      <View style={{ flex: 2 }}>
        <Text style={[styles.td, { fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{businessName}</Text>
        <Text style={[styles.td, styles.tdMuted, { fontSize: 6, marginTop: 1 }]}>{businessAddress.replace(/\n/g, ', ')}</Text>
      </View>
    )
  }
  if (!deliveryAddress) return <Text style={[styles.td, styles.tdMuted, { flex: 2 }]}>—</Text>

  let normalised = deliveryAddress
  if (businessAddress && businessName && deliveryAddress.trim() === businessAddress.trim()) {
    normalised = `${businessName}\n${businessAddress}`
  }

  const lines = normalised.split('\n')
  const firstLine = lines[0]
  const restLines = lines.slice(1).join(', ')
  const matchedSup = allSuppliers.find(s => s.supplier_name === firstLine)
  const contactName = matchedSup?.delivery_contact_name
  const contactNumber = matchedSup?.delivery_contact_number
  return (
    <View style={{ flex: 2 }}>
      {firstLine ? <Text style={[styles.td, { fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>{firstLine}</Text> : null}
      {(contactName || contactNumber) ? (
        <Text style={[styles.td, styles.tdMuted, { fontSize: 6, marginTop: 1 }]}>
          {[contactName, contactNumber].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {restLines ? <Text style={[styles.td, styles.tdMuted, { fontSize: 6, marginTop: 1 }]}>{restLines}</Text> : null}
    </View>
  )
}

function POPage({ project, items, allItems, allSuppliers, supplier, vatRate = 15, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate, platformContacts }: {
  project: Project
  items: LineItem[]
  allItems: LineItem[]
  allSuppliers: Supplier[]
  supplier: Supplier | null
  vatRate?: number
  logoUrl?: string | null
  businessName?: string | null
  businessAddress?: string | null
  vatNumber?: string | null
  companyReg?: string | null
  printDate?: string | null
  platformContacts?: { supplier_id: string; email: string | null; rep_name?: string | null; rep_email?: string | null }[]
}) {
  const itemRows = items.filter(i => i.row_type !== 'section')
  const subtotal = itemRows.reduce((sum, i) => sum + i.cost_price * i.quantity, 0)
  const vatAmount = subtotal * (vatRate / 100)
  const grandTotal = subtotal + vatAmount
  const poNumber = `${project.project_number}-${supplier?.supplier_name.slice(0, 3).toUpperCase() ?? 'GEN'}`

  const platformContact = supplier?.is_platform ? platformContacts?.find(c => c.supplier_id === supplier.id) : null
  const toEmail = supplier?.is_platform ? supplier.email : (platformContact?.email || supplier?.email)
  const ccEmail = supplier?.is_platform ? platformContact?.email : null
  const repName = platformContact?.rep_name || (supplier as any)?.rep_name

  let itemNumber = 0

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
          <Text style={styles.docMeta}>#{poNumber}</Text>
          <Text style={styles.docMeta}>{new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </View>

      {/* Supplier details */}
      {supplier && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPLIER</Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>{supplier.supplier_name}</Text>
            {repName && <Text style={[styles.infoVal, { marginBottom: 2 }]}>Attn: {repName}</Text>}
            {toEmail && <Text style={styles.infoVal}>{toEmail}</Text>}
            {ccEmail && <Text style={[styles.infoVal, { fontSize: 7, color: '#8A877F', marginTop: 1 }]}>CC: {ccEmail}</Text>}
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
            <Text style={[styles.th, { width: 20 }]}>#</Text>
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

            // Items with parent_item_id are linked fabrics — they show as their own rows on their supplier's PO
            // and as linked notes on the parent supplier's PO (via linkedChildren below)
            // We do NOT skip them here; the pre-filtering by supplier already handles separation

            itemNumber++

            // Linked children that belong to other suppliers — show as a compact note under this item
            const linkedChildren = allItems.filter(
              li => li.parent_item_id === item.id && li.row_type === 'item' && li.supplier_id !== supplier?.id
            )

            return (
              <View key={item.id}>
                <View style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.td, styles.tdMuted, { width: 20, fontSize: 6.5 }]}>{itemNumber}.</Text>
                  <View style={[{ flex: 2 }]}>
                    <Text style={styles.td}>{cap(item.item_name)}</Text>
                    {(item.dimensions || item.colour_finish) ? (
                      <Text style={[styles.td, styles.tdMuted, { fontSize: 6, marginTop: 1 }]}>
                        {[item.dimensions, item.colour_finish].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.td, styles.tdMuted, { flex: 3, paddingLeft: 6, paddingRight: 8 }]}>{item.description ?? ''}</Text>
                  <DeliverToCell deliveryAddress={item.delivery_address} allSuppliers={allSuppliers} businessName={businessName} businessAddress={businessAddress} />
                  <Text style={[styles.td, styles.tdMuted, { width: 36, textAlign: 'right', paddingRight: 4 }]}>{item.lead_time_days != null ? `${item.lead_time_days}d` : item.lead_time_weeks ? `${item.lead_time_weeks}w` : ''}</Text>
                  <Text style={[styles.td, { width: 52, textAlign: 'right', paddingRight: 8 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                  <Text style={[styles.td, { width: 72, textAlign: 'right' }]}>{formatZAR(item.cost_price)}</Text>
                  <Text style={[styles.td, { width: 72, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(item.cost_price * item.quantity)}</Text>
                </View>
                {/* Linked fabric/child items from other suppliers shown as compact notes */}
                {linkedChildren.map(child => {
                  const childSup = allSuppliers.find(s => s.id === child.supplier_id)
                  return (
                    <View key={child.id} style={{ flexDirection: 'row', paddingLeft: 28, paddingRight: 8, paddingVertical: 4, backgroundColor: '#F8F6F2', borderTopWidth: 0.5, borderTopColor: '#EDE9E1', alignItems: 'center', gap: 6 }}>
                      {/* Visual link indicator */}
                      <View style={{ width: 2, height: 26, backgroundColor: '#C4A46B', borderRadius: 1, flexShrink: 0 }} />
                      {child.fabric_image_url ? (
                        <Image src={child.fabric_image_url} style={{ width: 26, height: 26, borderRadius: 3, flexShrink: 0 }} />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 7.5, color: '#2C2C2A', fontFamily: 'Helvetica-Bold' }}>
                            {cap(child.item_name)}{child.colour_finish ? ` — ${child.colour_finish}` : ''}
                          </Text>
                          <Text style={{ fontSize: 7.5, color: '#8A877F' }}>
                            {child.quantity}{child.unit ? ` ${child.unit}` : ''}
                          </Text>
                        </View>
                        {childSup ? (
                          <Text style={{ fontSize: 6, color: '#C4A46B', marginTop: 2 }}>via {childSup.supplier_name}</Text>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
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
        <Text style={[styles.footerText, { textAlign: 'left' }]}>Please reference PO number #{poNumber} on all correspondence and delivery notes.</Text>
      </View>
    </Page>
  )
}

export function POPDF({ project, lineItems, allLineItems, suppliers, supplierId, vatRate = 15, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate, platformContacts }: Props) {
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))
  const fullItems = allLineItems ?? lineItems
  const pageProps = { vatRate, logoUrl, businessName, businessAddress, vatNumber, companyReg, printDate, platformContacts, allItems: fullItems, allSuppliers: suppliers }

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
  // Include all supplier IDs (including those whose items are linked children like Home Fabrics)
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
