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

export function BoldTemplate({ project, client, lineItems, type, theme, vatRate = 15, depositPct = 50, footerText, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, termsConditions, quotedDate, validityDays, paymentTerms, leadTime }: TemplateProps) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee, vatRate, depositPct)
  const issuedDate = quotedDate ?? new Date().toISOString().split('T')[0]
  const validUntil = (type === 'quote' && validityDays) ? addDays(issuedDate, validityDays) : null

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 9, color: theme.text, padding: 0, flexDirection: 'column' }}>

        {/* Dark full-width header band */}
        <View style={{ backgroundColor: theme.headerBg, paddingVertical: 32, paddingHorizontal: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <View style={{ alignItems: 'flex-start' }}><Image src={logoUrl} style={{ maxWidth: 220, maxHeight: 60, objectFit: 'contain' }} /></View>
              : <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: theme.headerText, letterSpacing: 1 }}>{businessName || 'Studio'}</Text>
            }
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', color: theme.headerText, letterSpacing: 2 }}>
              {type === 'quote' ? 'QUOTATION' : 'INVOICE'}
            </Text>
            <Text style={{ fontSize: 11, color: theme.accent === theme.headerBg ? theme.headerText : theme.accent, marginTop: 6, letterSpacing: 1 }}>
              #{project.project_number}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 48, paddingTop: 28, paddingBottom: 32, flexDirection: 'column' }}>

          {/* Meta row: business info left, dates right */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <View style={{ flex: 1 }}>
              {businessAddress ? (
                <Text style={{ fontSize: 7.5, color: theme.muted, lineHeight: 1.6 }}>
                  {businessAddress.replace(/\n/g, '\n')}
                </Text>
              ) : null}
              {(vatNumber || companyReg) ? (
                <Text style={{ fontSize: 7.5, color: theme.muted, marginTop: 4 }}>
                  {[vatNumber ? `VAT: ${vatNumber}` : null, companyReg ? `Reg: ${companyReg}` : null].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7.5, color: theme.muted }}>Date Issued</Text>
              <Text style={{ fontSize: 9, color: theme.text, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>{formatDate(issuedDate)}</Text>
              {validUntil ? (
                <>
                  <Text style={{ fontSize: 7.5, color: theme.muted, marginTop: 8 }}>Valid Until</Text>
                  <Text style={{ fontSize: 9, color: theme.accent, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>{formatDate(validUntil)}</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Client + Project */}
          <View style={{ flexDirection: 'row', gap: 32, marginBottom: 24 }}>
            {client ? (
              <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 4, padding: 14 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 8 }}>BILLED TO</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{client.client_name}</Text>
                {client.company && <Text style={{ fontSize: 8.5, color: theme.text, marginTop: 3 }}>{client.company}</Text>}
                {client.vat_number && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>VAT: {client.vat_number}</Text>}
                {client.address && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.address}</Text>}
                {client.contact_number && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.contact_number}</Text>}
              </View>
            ) : null}
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 4, padding: 14 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 8 }}>PROJECT</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{project.project_name}</Text>
            </View>
          </View>

          {/* Table */}
          <View style={{ marginBottom: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', backgroundColor: theme.primary, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 3 }}>
              <Text style={{ fontSize: 8, color: theme.headerText, fontFamily: 'Helvetica-Bold', width: 22 }}>#</Text>
              <Text style={{ fontSize: 8, color: theme.headerText, fontFamily: 'Helvetica-Bold', flex: 1 }}>ITEM</Text>
              <Text style={{ fontSize: 8, color: theme.headerText, fontFamily: 'Helvetica-Bold', width: 44, textAlign: 'right', paddingRight: 8 }}>QTY</Text>
              <Text style={{ fontSize: 8, color: theme.headerText, fontFamily: 'Helvetica-Bold', width: 72, textAlign: 'right' }}>UNIT PRICE</Text>
              <Text style={{ fontSize: 8, color: theme.headerText, fontFamily: 'Helvetica-Bold', width: 80, textAlign: 'right' }}>TOTAL</Text>
            </View>
            {(() => {
              let itemIndex = 0
              let itemNum = 0
              return lineItems.map(item => {
                if (item.row_type === 'section') {
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: theme.accent, marginTop: 6 }}>
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 0.5 }}>{(item.item_name || 'Section').toUpperCase()}</Text>
                    </View>
                  )
                }
                const c = computed.find(ci => ci.id === item.id)
                if (!c) return null
                itemIndex++
                itemNum++
                return (
                  <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                    <Text style={{ fontSize: 7, color: theme.muted, width: 22 }}>{itemNum}.</Text>
                    <Text style={{ fontSize: 9, color: theme.text, flex: 1, paddingLeft: item.indent_level > 0 ? 8 : 0 }}>{cap(item.item_name)}</Text>
                    <Text style={{ fontSize: 9, color: theme.text, width: 44, textAlign: 'right', paddingRight: 8 }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                    <Text style={{ fontSize: 9, color: theme.text, width: 72, textAlign: 'right' }}>{formatZAR(c.sale_price)}</Text>
                    <Text style={{ fontSize: 9, color: theme.primary, width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{formatZAR(c.total_price)}</Text>
                  </View>
                )
              })
            })()}
          </View>

          {/* Totals + banking */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
            {bankName || bankAccount ? (
              <View style={{ width: 200 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 8 }}>BANKING DETAILS</Text>
                {bankName ? <Text style={{ fontSize: 8.5, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{bankName}</Text> : null}
                {bankAccount ? <Text style={{ fontSize: 8, color: theme.muted, marginTop: 3 }}>Acc: {bankAccount}</Text> : null}
                {bankBranch ? <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>Branch: {bankBranch}</Text> : null}
              </View>
            ) : <View />}

            <View style={{ width: 230 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>Subtotal</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.subtotal)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>Design Fee ({project.design_fee ?? 0}%)</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.design_fee)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted }}>VAT ({vatRate}%)</Text>
                <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(totals.vat_amount)}</Text>
              </View>
              <View style={{ backgroundColor: theme.primary, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.headerText }}>TOTAL</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.headerText }}>{formatZAR(totals.grand_total)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 }}>
                <Text style={{ fontSize: 8, color: theme.accent }}>{depositPct}% Deposit Required</Text>
                <Text style={{ fontSize: 8, color: theme.accent, fontFamily: 'Helvetica-Bold' }}>{formatZAR(totals.deposit)}</Text>
              </View>
              {type === 'invoice' && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 }}>
                  <Text style={{ fontSize: 8, color: theme.muted }}>{100 - depositPct}% Due Before Delivery</Text>
                  <Text style={{ fontSize: 8, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{formatZAR(totals.balance_due)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Terms */}
          {termsConditions ? (
            <View style={{ marginTop: 20, backgroundColor: theme.surface, borderRadius: 4, padding: 14 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 6 }}>TERMS &amp; CONDITIONS</Text>
              <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{termsConditions}</Text>
            </View>
          ) : null}

          {(paymentTerms || leadTime) ? (
            <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
              {paymentTerms ? (
                <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 4, padding: 12 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 5 }}>PAYMENT TERMS</Text>
                  <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{paymentTerms}</Text>
                </View>
              ) : null}
              {leadTime ? (
                <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 4, padding: 12 }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 5 }}>ESTIMATED LEAD TIME</Text>
                  <Text style={{ fontSize: 7, color: theme.text, lineHeight: 1.5 }}>{leadTime}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Acceptance */}
          {type === 'quote' ? (
            <View style={{ marginTop: 20, borderTopWidth: 2, borderTopColor: theme.primary, paddingTop: 14 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1, marginBottom: 8 }}>ACCEPTANCE</Text>
              <Text style={{ fontSize: 7, color: theme.muted, marginBottom: 14, lineHeight: 1.5 }}>
                Acceptance of this quotation may be confirmed by signing below or by payment of the required deposit. Either constitutes agreement to the above quotation and its terms and conditions.
              </Text>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                {(['Full Name', 'Signature', 'Date'] as const).map(label => (
                  <View key={label} style={{ flex: 1 }}>
                    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.primary, marginBottom: 4, paddingBottom: 18 }} />
                    <Text style={{ fontSize: 7, color: theme.muted }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

        </View>

        {/* Footer */}
        <View style={{ backgroundColor: theme.surface, paddingVertical: 12, paddingHorizontal: 48, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 8, color: theme.muted, textAlign: 'center' }}>{footerText ?? 'Thank you for your business.'}</Text>
        </View>
      </Page>
    </Document>
  )
}
