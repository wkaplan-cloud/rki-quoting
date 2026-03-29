import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { styles } from './styles'
import { computeLineItems, computeTotals, formatZAR } from '../quoting'
import type { Project, LineItem, Client } from '../types'

interface Props {
  project: Project
  client: Client | null
  lineItems: LineItem[]
  type: 'quote' | 'invoice'
  vatRate?: number
  footerText?: string
  logoUrl?: string | null
  businessName?: string | null
  businessAddress?: string | null
  vatNumber?: string | null
  companyReg?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankBranch?: string | null
  termsConditions?: string | null
  printDate?: string | null
}

export function QuotePDF({ project, client, lineItems, type, vatRate = 15, footerText, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, termsConditions, printDate }: Props) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee, vatRate)

  return (
    <Document>
      <Page size="A4" style={{ ...styles.page, flexDirection: 'column' }}>
        <View style={{ flex: 1 }}>
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
            <Text style={styles.docTitle}>{type === 'quote' ? 'QUOTATION' : 'INVOICE'}</Text>
            <Text style={styles.docMeta}>{`#${project.project_number}`}</Text>
            <Text style={styles.docMeta}>{new Date(printDate ?? new Date()).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Client + Project row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 8 }}>
          {client ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Client</Text>
              <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{client.client_name}</Text>
              {client.company && (
                <Text style={styles.infoVal}>{client.company}{client.vat_number ? `  ·  VAT: ${client.vat_number}` : ''}</Text>
              )}
              {!client.company && client.vat_number && <Text style={styles.infoVal}>VAT: {client.vat_number}</Text>}
              {client.address && <Text style={styles.infoVal}>{client.address}</Text>}
              {client.contact_number && <Text style={styles.infoVal}>{client.contact_number}</Text>}
            </View>
          ) : <View style={{ flex: 1 }} />}
          <View style={{ flex: 1, paddingLeft: 24 }}>
            <Text style={styles.sectionLabel}>Project</Text>
            <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{project.project_name}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={{ marginBottom: 20 }}>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1 }]}>ITEM</Text>
              <Text style={[styles.th, { width: 44, textAlign: 'right', paddingRight: 8 }]}>QTY</Text>
              <Text style={[styles.th, { width: 72, textAlign: 'right' }]}>SALE PRICE</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'right' }]}>TOTAL</Text>
            </View>
            {/* Rows — sections + items */}
            {(() => {
              let itemIndex = 0
              return lineItems.map(item => {
                if (item.row_type === 'section') {
                  return (
                    <View key={item.id} style={styles.tableSectionRow}>
                      <Text style={styles.tableSectionLabel}>{(item.item_name || 'Section').toUpperCase()}</Text>
                    </View>
                  )
                }
                const c = computed.find(ci => ci.id === item.id)
                if (!c) return null
                const alt = itemIndex++ % 2 === 1
                return (
                  <View key={item.id} style={[styles.tableRow, alt ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.td, { flex: 1, paddingLeft: item.indent_level > 0 ? 8 : 0 }]}>{item.item_name}</Text>
                    <Text style={[styles.td, { width: 44, textAlign: 'right', paddingRight: 8 }]}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                    <Text style={[styles.td, { width: 72, textAlign: 'right' }]}>{formatZAR(c.sale_price)}</Text>
                    <Text style={[styles.td, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(c.total_price)}</Text>
                  </View>
                )
              })
            })()}
          </View>
        </View>

        {/* Totals row: banking left + totals right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', marginTop: 16 }}>
          {/* Banking details */}
          {bankName || bankAccount ? (
            <View style={{ borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12, width: 200 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 4 }}>BANKING DETAILS</Text>
              {bankName ? <Text style={{ fontSize: 7, color: '#2C2C2A', marginBottom: 3 }}>{bankName}</Text> : null}
              {bankAccount ? <><Text style={{ fontSize: 6, color: '#8A877F', marginBottom: 1 }}>Account Number</Text><Text style={{ fontSize: 7, color: '#2C2C2A', marginBottom: 3 }}>{bankAccount}</Text></> : null}
              {bankBranch ? <><Text style={{ fontSize: 6, color: '#8A877F', marginBottom: 1 }}>Branch Code</Text><Text style={{ fontSize: 7, color: '#2C2C2A' }}>{bankBranch}</Text></> : null}
            </View>
          ) : <View />}
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsVal}>{formatZAR(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Design Fee ({project.design_fee ?? 0}%)</Text>
              <Text style={styles.totalsVal}>{formatZAR(totals.design_fee)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT (15%)</Text>
              <Text style={styles.totalsVal}>{formatZAR(totals.vat_amount)}</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsBig}>
              <Text style={styles.totalsBigLabel}>TOTAL</Text>
              <Text style={styles.totalsBigVal}>{formatZAR(totals.grand_total)}</Text>
            </View>
            <View style={styles.totalsDeposit}>
              <Text style={styles.totalsDepositLabel}>70% Deposit Required</Text>
              <Text style={styles.totalsDepositVal}>{formatZAR(totals.deposit_70)}</Text>
            </View>
            {type === 'invoice' && (
              <View style={[styles.totalsRow, { marginTop: 4 }]}>
                <Text style={styles.totalsLabel}>30% Due Before Delivery</Text>
                <Text style={[styles.totalsVal, { fontFamily: 'Helvetica-Bold' }]}>{formatZAR(totals.balance_due)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Terms & Conditions */}
        {termsConditions ? (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 4 }}>TERMS &amp; CONDITIONS</Text>
            <Text style={{ fontSize: 7, color: '#2C2C2A', lineHeight: 1.5 }}>{termsConditions}</Text>
          </View>
        ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {footerText ?? 'Thank you for your business. All prices quoted are valid for 30 days. A 70% deposit is required to confirm your order.'}
          </Text>
          <View style={styles.footerSig}>
            <View style={styles.sigLine}><Text>Authorised Signature</Text></View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
