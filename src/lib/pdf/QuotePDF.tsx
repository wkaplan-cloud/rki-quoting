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
  depositPct?: number
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
  quotedDate?: string | null
  validityDays?: number | null
  paymentTerms?: string | null
  leadTime?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function QuotePDF({ project, client, lineItems, type, vatRate = 15, depositPct = 70, footerText, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, termsConditions, quotedDate, validityDays, paymentTerms, leadTime }: Props) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee, vatRate, depositPct)

  const issuedDate = quotedDate ?? new Date().toISOString().split('T')[0]
  const validUntil = (type === 'quote' && validityDays) ? addDays(issuedDate, validityDays) : null

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
            <Text style={styles.docMeta}>Date Issued: {formatDate(issuedDate)}</Text>
            {validUntil ? <Text style={[styles.docMeta, { color: '#9A7B4F' }]}>Valid Until: {formatDate(validUntil)}</Text> : null}
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
            <View style={{ borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12, width: 220 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 4 }}>BANKING DETAILS</Text>
              {bankName ? <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#2C2C2A', marginBottom: 6 }}>{bankName}</Text> : null}
              {bankAccount ? <><Text style={{ fontSize: 7, color: '#8A877F', marginBottom: 2 }}>Account Number</Text><Text style={{ fontSize: 8, color: '#2C2C2A', marginBottom: 5 }}>{bankAccount}</Text></> : null}
              {bankBranch ? <><Text style={{ fontSize: 7, color: '#8A877F', marginBottom: 2 }}>Branch Code</Text><Text style={{ fontSize: 8, color: '#2C2C2A' }}>{bankBranch}</Text></> : null}
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
              <Text style={styles.totalsLabel}>VAT ({vatRate}%)</Text>
              <Text style={styles.totalsVal}>{formatZAR(totals.vat_amount)}</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsBig}>
              <Text style={styles.totalsBigLabel}>TOTAL</Text>
              <Text style={styles.totalsBigVal}>{formatZAR(totals.grand_total)}</Text>
            </View>
            <View style={styles.totalsDeposit}>
              <Text style={styles.totalsDepositLabel}>{depositPct}% Deposit Required</Text>
              <Text style={styles.totalsDepositVal}>{formatZAR(totals.deposit)}</Text>
            </View>
            {type === 'invoice' && (
              <View style={[styles.totalsRow, { marginTop: 4 }]}>
                <Text style={styles.totalsLabel}>{100 - depositPct}% Due Before Delivery</Text>
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

        {/* Payment Terms + Lead Time */}
        {(paymentTerms || leadTime) ? (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
            {paymentTerms ? (
              <View style={{ flex: 1, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 10 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 3 }}>PAYMENT TERMS</Text>
                <Text style={{ fontSize: 7, color: '#2C2C2A', lineHeight: 1.5 }}>{paymentTerms}</Text>
              </View>
            ) : null}
            {leadTime ? (
              <View style={{ flex: 1, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 10 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 3 }}>ESTIMATED LEAD TIME</Text>
                <Text style={{ fontSize: 7, color: '#2C2C2A', lineHeight: 1.5 }}>{leadTime}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Acceptance block — quotes only */}
        {type === 'quote' ? (
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 12 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8A877F', marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingBottom: 4 }}>ACCEPTANCE</Text>
            <Text style={{ fontSize: 7, color: '#2C2C2A', marginBottom: 12, lineHeight: 1.5 }}>
              Acceptance of this quotation may be confirmed by signing below or by payment of the required deposit. Either constitutes agreement to the above quotation and its terms and conditions.
            </Text>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#2C2C2A', marginBottom: 4, paddingBottom: 16 }} />
                <Text style={{ fontSize: 7, color: '#8A877F' }}>Full Name</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#2C2C2A', marginBottom: 4, paddingBottom: 16 }} />
                <Text style={{ fontSize: 7, color: '#8A877F' }}>Signature</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#2C2C2A', marginBottom: 4, paddingBottom: 16 }} />
                <Text style={{ fontSize: 7, color: '#8A877F' }}>Date</Text>
              </View>
            </View>
          </View>
        ) : null}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { justifyContent: 'flex-start' }]}>
          <Text style={styles.footerText}>
            {footerText ?? 'Thank you for your business.'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
