import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { styles } from './styles'
import { computeLineItems, computeTotals, formatZAR } from '../quoting'
import type { Project, LineItem, Client } from '../types'

interface Props {
  project: Project
  client: Client | null
  lineItems: LineItem[]
  type: 'quote' | 'invoice'
  footerText?: string
  logoUrl?: string | null
  businessName?: string | null
  termsConditions?: string | null
}

export function QuotePDF({ project, client, lineItems, type, footerText, logoUrl, businessName, termsConditions }: Props) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee)

  return (
    <Document>
      <Page size="A4" style={{ ...styles.page, flexDirection: 'column' }}>
        <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ justifyContent: 'center' }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 300, objectFit: 'contain' }} />
              : <Text style={styles.brandName}>{businessName || 'R Kaplan Interiors'}</Text>
            }
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.docTitle}>{type === 'quote' ? 'QUOTATION' : 'INVOICE'}</Text>
            <Text style={styles.docMeta}>{project.project_number}</Text>
            <Text style={styles.docMeta}>{new Date(project.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Client */}
        {client && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Client</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoBlock}>
                <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{client.client_name}</Text>
                {client.company && <Text style={styles.infoVal}>{client.company}</Text>}
                {client.address && <Text style={styles.infoVal}>{client.address}</Text>}
              </View>
              <View style={[styles.infoBlock, { alignItems: 'flex-end' }]}>
                {client.vat_number && <><Text style={[styles.infoKey, { textAlign: 'right' }]}>VAT Number</Text><Text style={[styles.infoVal, { textAlign: 'right' }]}>{client.vat_number}</Text></>}
                {client.contact_number && <><Text style={[styles.infoKey, { marginTop: 4, textAlign: 'right' }]}>Contact</Text><Text style={[styles.infoVal, { textAlign: 'right' }]}>{client.contact_number}</Text></>}
              </View>
            </View>
          </View>
        )}

        {/* Project info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Project</Text>
          <Text style={[styles.infoVal, { fontFamily: 'Helvetica-Bold' }]}>{project.project_name}</Text>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ITEMS</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>ITEM</Text>
              <Text style={[styles.th, { flex: 3 }]}>DESCRIPTION</Text>
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
                    <Text style={[styles.td, { flex: 2, paddingLeft: item.indent_level > 0 ? 8 : 0 }]}>{item.item_name}</Text>
                    <Text style={[styles.td, styles.tdMuted, { flex: 3 }]}>{item.description ?? ''}</Text>
                    <Text style={[styles.td, { width: 44, textAlign: 'right', paddingRight: 8 }]}>{item.quantity}</Text>
                    <Text style={[styles.td, { width: 72, textAlign: 'right' }]}>{formatZAR(c.sale_price)}</Text>
                    <Text style={[styles.td, { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{formatZAR(c.total_price)}</Text>
                  </View>
                )
              })
            })()}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
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
                <Text style={styles.totalsLabel}>Balance Due</Text>
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
