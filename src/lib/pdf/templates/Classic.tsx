import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { computeLineItems, computeTotals, formatZAR } from '@/lib/quoting'
import type { TemplateProps } from './types'

function cap(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function ClassicTemplate({ project, client, lineItems, type, theme, vatRate = 15, depositPct = 50, footerText, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, termsConditions, quotedDate, validityDays, paymentTerms, leadTime }: TemplateProps) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee, vatRate, depositPct)
  const issuedDate = quotedDate ?? new Date().toISOString().split('T')[0]
  const validUntil = (type === 'quote' && validityDays) ? addDays(issuedDate, validityDays) : null

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 9, color: theme.text, padding: 48, flexDirection: 'column' }}>
        <View style={{ flex: 1 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <View>
              {logoUrl
                ? <Image src={logoUrl} style={{ maxWidth: 300, objectFit: 'contain', marginBottom: 8 }} />
                : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.5, marginBottom: 8 }}>{businessName || 'Studio'}</Text>
              }
              {businessAddress ? (
                <Text style={{ fontSize: 7, color: theme.muted, marginBottom: 3, lineHeight: 1.4 }}>
                  {businessAddress.replace(/\n/g, ', ')}
                </Text>
              ) : null}
              {(vatNumber || companyReg) ? (
                <Text style={{ fontSize: 7, color: theme.muted }}>
                  {[vatNumber ? `VAT: ${vatNumber}` : null, companyReg ? `Reg: ${companyReg}` : null].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: theme.primary, textAlign: 'right' }}>{type === 'quote' ? 'QUOTATION' : 'INVOICE'}</Text>
              <Text style={{ fontSize: 8, color: theme.muted, textAlign: 'right', marginTop: 4 }}>{`#${project.project_number}`}</Text>
              <Text style={{ fontSize: 8, color: theme.muted, textAlign: 'right', marginTop: 4 }}>Date Issued: {formatDate(issuedDate)}</Text>
              {validUntil ? <Text style={{ fontSize: 8, color: theme.accent, textAlign: 'right', marginTop: 4 }}>Valid Until: {formatDate(validUntil)}</Text> : null}
            </View>
          </View>

          {/* Client + Project */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 8 }}>
            {client ? (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: theme.accent, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 4 }}>CLIENT</Text>
                <Text style={{ fontSize: 9, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{client.client_name}</Text>
                {client.company && <Text style={{ fontSize: 9, color: theme.text }}>{client.company}{client.vat_number ? `  ·  VAT: ${client.vat_number}` : ''}</Text>}
                {!client.company && client.vat_number && <Text style={{ fontSize: 9, color: theme.text }}>VAT: {client.vat_number}</Text>}
                {client.address && <Text style={{ fontSize: 9, color: theme.text }}>{client.address}</Text>}
                {client.contact_number && <Text style={{ fontSize: 9, color: theme.text }}>{client.contact_number}</Text>}
              </View>
            ) : <View style={{ flex: 1 }} />}
            <View style={{ flex: 1, paddingLeft: 24 }}>
              <Text style={{ fontSize: 7, color: theme.accent, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 4 }}>PROJECT</Text>
              <Text style={{ fontSize: 9, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{project.project_name}</Text>
            </View>
          </View>

          {/* Line items table */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', backgroundColor: theme.surface, paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ fontSize: 9, color: theme.muted, fontFamily: 'Helvetica-Bold', width: 20 }}>#</Text>
                <Text style={{ fontSize: 9, color: theme.muted, fontFamily: 'Helvetica-Bold', flex: 1 }}>ITEM</Text>
                <Text style={{ fontSize: 9, color: theme.muted, fontFamily: 'Helvetica-Bold', width: 44, textAlign: 'right', paddingRight: 8 }}>QTY</Text>
                <Text style={{ fontSize: 9, color: theme.muted, fontFamily: 'Helvetica-Bold', width: 72, textAlign: 'right' }}>SALE PRICE</Text>
                <Text style={{ fontSize: 9, color: theme.muted, fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' }}>TOTAL</Text>
              </View>
              {(() => {
                let itemIndex = 0
                let itemNum = 0
                return lineItems.map(item => {
                  if (item.row_type === 'section') {
                    return (
                      <View key={item.id} style={{ flexDirection: 'row', backgroundColor: theme.surface, paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border, marginTop: 4 }}>
                        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.muted }}>{(item.item_name || 'Section').toUpperCase()}</Text>
                      </View>
                    )
                  }
                  const c = computed.find(ci => ci.id === item.id)
                  if (!c) return null
                  itemIndex++
                  itemNum++
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                      <Text style={{ fontSize: 6.5, color: theme.muted, width: 20 }}>{itemNum}.</Text>
                      <Text style={{ fontSize: 9, color: theme.text, flex: 1, paddingLeft: item.indent_level > 0 ? 8 : 0 }}>{cap(item.item_name)}</Text>
                      <Text style={{ fontSize: 9, color: theme.text, width: 44, textAlign: 'right', paddingRight: 8 }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                      <Text style={{ fontSize: 9, color: theme.text, width: 72, textAlign: 'right' }}>{formatZAR(c.sale_price)}</Text>
                      <Text style={{ fontSize: 9, color: theme.text, width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{formatZAR(c.total_price)}</Text>
                    </View>
                  )
                })
              })()}
            </View>
          </View>

          {/* Totals row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', marginTop: 16 }}>
            {bankName || bankAccount ? (
              <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 12, width: 220 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.muted, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 4 }}>BANKING DETAILS</Text>
                {bankName ? <Text style={{ fontSize: 8, color: theme.text, marginBottom: 5 }}>{bankName}</Text> : null}
                {bankAccount ? <><Text style={{ fontSize: 7, color: theme.muted, marginBottom: 2 }}>Account Number</Text><Text style={{ fontSize: 8, color: theme.text, marginBottom: 5 }}>{bankAccount}</Text></> : null}
                {bankBranch ? <><Text style={{ fontSize: 7, color: theme.muted, marginBottom: 2 }}>Branch Code</Text><Text style={{ fontSize: 8, color: theme.text }}>{bankBranch}</Text></> : null}
              </View>
            ) : <View />}
            <View style={{ width: 220, borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>Subtotal</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.subtotal)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>Design Fee ({project.design_fee ?? 0}%)</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.design_fee)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>VAT ({vatRate}%)</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.vat_amount)}</Text>
              </View>
              <View style={{ borderTopWidth: 0.5, borderTopColor: theme.border, marginVertical: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>TOTAL</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{formatZAR(totals.grand_total)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 8, color: theme.accent }}>{depositPct}% Deposit Required</Text>
                <Text style={{ fontSize: 8, color: theme.accent, fontFamily: 'Helvetica-Bold' }}>{formatZAR(totals.deposit)}</Text>
              </View>
              {type === 'invoice' && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 8, color: theme.muted }}>{100 - depositPct}% Due Before Delivery</Text>
                  <Text style={{ fontSize: 8, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{formatZAR(totals.balance_due)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Terms */}
          {termsConditions ? (
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 12 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.muted, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 4 }}>TERMS &amp; CONDITIONS</Text>
              <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{termsConditions}</Text>
            </View>
          ) : null}

          {/* Payment Terms + Lead Time */}
          {(paymentTerms || leadTime) ? (
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
              {paymentTerms ? (
                <View style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 10 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.muted, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 3 }}>PAYMENT TERMS</Text>
                  <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{paymentTerms}</Text>
                </View>
              ) : null}
              {leadTime ? (
                <View style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 10 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.muted, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 3 }}>ESTIMATED LEAD TIME</Text>
                  <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{leadTime}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Acceptance block */}
          {type === 'quote' ? (
            <View style={{ marginTop: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 4, padding: 12 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.muted, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingBottom: 4 }}>ACCEPTANCE</Text>
              <Text style={{ fontSize: 7, color: theme.text, marginBottom: 12, lineHeight: 1.5 }}>
                Acceptance of this quotation may be confirmed by signing below or by payment of the required deposit. Either constitutes agreement to the above quotation and its terms and conditions.
              </Text>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                {(['Full Name', 'Signature', 'Date'] as const).map(label => (
                  <View key={label} style={{ flex: 1 }}>
                    <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.text, marginBottom: 4, paddingBottom: 16 }} />
                    <Text style={{ fontSize: 7, color: theme.muted }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </View>

        {/* Footer */}
        <View style={{ marginTop: 24, borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'flex-start' }}>
          <Text style={{ fontSize: 9, color: theme.muted, flex: 1, textAlign: 'center' }}>{footerText ?? 'Thank you for your business.'}</Text>
        </View>
      </Page>
    </Document>
  )
}
