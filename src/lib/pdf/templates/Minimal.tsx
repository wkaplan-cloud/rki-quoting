import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { todaySA } from '@/lib/dates'
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

export function MinimalTemplate({ project, client, lineItems, type, theme, vatRate = 15, depositPct = 50, amountPaid = 0, footerText, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, termsConditions, quotedDate, invoicedDate, validityDays, paymentTerms, leadTime, itemImages, acceptance }: TemplateProps) {
  const computed = computeLineItems(lineItems)
  const totals = computeTotals(lineItems, project.design_fee, vatRate, depositPct)
  // Never show more paid than the invoice is worth, or a negative amount due
  const depositReceived = Math.min(Math.max(amountPaid, 0), totals.grand_total)
  const amountDue = totals.grand_total - depositReceived
  const issuedDate = (type === 'invoice' ? invoicedDate ?? quotedDate : quotedDate) ?? todaySA()
  const validUntil = (type === 'quote' && validityDays) ? addDays(issuedDate, validityDays) : null

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 9, color: theme.text, padding: 56, flexDirection: 'column' }}>
        <View style={{ flex: 1 }}>

          {/* Header — logo/name top-left, doc type as small label top-right */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              {logoUrl
                ? <View style={{ alignItems: 'flex-start' }}><Image src={logoUrl} style={{ maxWidth: 240, maxHeight: 56, objectFit: 'contain' }} /></View>
                : <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.3 }}>{businessName || 'Studio'}</Text>
              }
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 2 }}>
                {type === 'quote' ? 'QUOTATION' : 'INVOICE'}
              </Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 2 }}>#{project.project_number}</Text>
            </View>
          </View>

          {/* Thin rule */}
          <View style={{ borderTopWidth: 1, borderTopColor: theme.primary, marginBottom: 28 }} />

          {/* Two-column: client left, meta right */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 36 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 8 }}>BILLED TO</Text>
              {client ? (
                <>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{client.client_name}</Text>
                  {client.company && <Text style={{ fontSize: 8.5, color: theme.text, marginTop: 3 }}>{client.company}</Text>}
                  {client.vat_number && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>VAT: {client.vat_number}</Text>}
                  {client.address && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.address}</Text>}
                  {client.contact_number && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.contact_number}</Text>}
                  {client.email && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.email}</Text>}
                </>
              ) : <Text style={{ fontSize: 8.5, color: theme.muted }}>—</Text>}
            </View>
            <View style={{ width: 200, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 8 }}>DETAILS</Text>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={{ fontSize: 7.5, color: theme.muted }}>Project</Text>
                  <Text style={{ fontSize: 7.5, color: theme.text, fontFamily: 'Helvetica-Bold' }}>{project.project_name}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={{ fontSize: 7.5, color: theme.muted }}>Date Issued</Text>
                  <Text style={{ fontSize: 7.5, color: theme.text }}>{formatDate(issuedDate)}</Text>
                </View>
                {validUntil ? (
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <Text style={{ fontSize: 7.5, color: theme.muted }}>Valid Until</Text>
                    <Text style={{ fontSize: 7.5, color: theme.accent }}>{formatDate(validUntil)}</Text>
                  </View>
                ) : null}
                {businessAddress ? (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                    <Text style={{ fontSize: 7.5, color: theme.muted }}>From</Text>
                    <Text style={{ fontSize: 7.5, color: theme.text, textAlign: 'right' }}>{businessAddress.replace(/\n/g, ', ')}</Text>
                  </View>
                ) : null}
                {(vatNumber || companyReg) ? (
                  <Text style={{ fontSize: 7, color: theme.muted }}>
                    {[vatNumber ? `VAT: ${vatNumber}` : null, companyReg ? `Reg: ${companyReg}` : null].filter(Boolean).join('  ·  ')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Table — no boxes, just lines */}
          <View style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: theme.primary }}>
              <Text style={{ fontSize: 7.5, color: theme.muted, letterSpacing: 1, width: 22 }}>#</Text>
              <Text style={{ fontSize: 7.5, color: theme.muted, letterSpacing: 1, flex: 1 }}>ITEM</Text>
              <Text style={{ fontSize: 7.5, color: theme.muted, letterSpacing: 1, width: 44, textAlign: 'right', paddingRight: 8 }}>QTY</Text>
              <Text style={{ fontSize: 7.5, color: theme.muted, letterSpacing: 1, width: 72, textAlign: 'right' }}>PRICE</Text>
              <Text style={{ fontSize: 7.5, color: theme.muted, letterSpacing: 1, width: 80, textAlign: 'right' }}>TOTAL</Text>
            </View>
            {(() => {
              let itemIndex = 0
              let itemNum = 0
              return lineItems.map(item => {
                if (item.row_type === 'section') {
                  return (
                    <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 1 }}>{(item.item_name || 'Section').toUpperCase()}</Text>
                    </View>
                  )
                }
                const c = computed.find(ci => ci.id === item.id)
                if (!c) return null
                itemIndex++
                itemNum++
                const img = itemImages?.[item.id]
                return (
                  <View key={item.id} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                    <Text style={{ fontSize: 7, color: theme.muted, width: 22 }}>{itemNum}.</Text>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: item.indent_level > 0 ? 8 : 0 }}>
                      {img ? <Image src={img} style={{ width: 42.5, height: 42.5, borderRadius: 2, objectFit: 'cover', marginRight: 8 }} /> : null}
                      <Text style={{ fontSize: 9, color: theme.text, flex: 1 }}>{cap(item.item_name)}</Text>
                    </View>
                    <Text style={{ fontSize: 9, color: theme.muted, width: 44, textAlign: 'right', paddingRight: 8 }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</Text>
                    <Text style={{ fontSize: 9, color: theme.text, width: 72, textAlign: 'right' }}>{formatZAR(c.sale_price)}</Text>
                    <Text style={{ fontSize: 9, color: theme.text, width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{formatZAR(c.total_price)}</Text>
                  </View>
                )
              })
            })()}
          </View>

          {/* Totals — right-aligned, minimal */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Banking — plain text, no box */}
            {bankName || bankAccount ? (
              <View style={{ width: 200 }}>
                <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 10 }}>BANKING DETAILS</Text>
                {bankName ? <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: theme.text }}>{bankName}</Text> : null}
                {bankAccount ? <Text style={{ fontSize: 8, color: theme.muted, marginTop: 3 }}>Acc: {bankAccount}</Text> : null}
                {bankBranch ? <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>Branch: {bankBranch}</Text> : null}
              </View>
            ) : <View />}

            <View style={{ width: 220 }}>
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
              <View style={{ borderTopWidth: 1, borderTopColor: theme.primary, marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.5 }}>TOTAL</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{formatZAR(totals.grand_total)}</Text>
              </View>
              {type === 'quote' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ fontSize: 8, color: theme.accent }}>{depositPct}% Deposit</Text>
                  <Text style={{ fontSize: 8, color: theme.accent }}>{formatZAR(totals.deposit)}</Text>
                </View>
              ) : depositReceived > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ fontSize: 8, color: theme.accent }}>Deposit Received</Text>
                    <Text style={{ fontSize: 8, color: theme.accent }}>-{formatZAR(depositReceived)}</Text>
                  </View>
                  <View style={{ borderTopWidth: 0.5, borderTopColor: theme.border, marginTop: 6, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.5 }}>AMOUNT DUE</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{formatZAR(amountDue)}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {/* Terms — plain, no box */}
          {termsConditions ? (
            <View style={{ marginTop: 28 }}>
              <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 8 }}>TERMS &amp; CONDITIONS</Text>
              <Text style={{ fontSize: 7, color: theme.muted, lineHeight: 1.7 }}>{termsConditions}</Text>
            </View>
          ) : null}

          {(paymentTerms || leadTime) ? (
            <View style={{ marginTop: 20, flexDirection: 'row', gap: 40 }}>
              {paymentTerms ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 6 }}>PAYMENT TERMS</Text>
                  <Text style={{ fontSize: 7, color: theme.muted, lineHeight: 1.7 }}>{paymentTerms}</Text>
                </View>
              ) : null}
              {leadTime ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 6 }}>ESTIMATED LEAD TIME</Text>
                  <Text style={{ fontSize: 7, color: theme.muted, lineHeight: 1.7 }}>{leadTime}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Acceptance — heading, wording and rules all come from studio settings */}
          {type === 'quote' && acceptance ? (
            <View style={{ marginTop: 28 }}>
              {acceptance.heading ? (
                <Text style={{ fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 8 }}>{acceptance.heading}</Text>
              ) : null}
              {acceptance.body ? (
                <Text style={{ fontSize: 7, color: theme.muted, marginBottom: 20, lineHeight: 1.7 }}>{acceptance.body}</Text>
              ) : null}
              {acceptance.labels.length ? (
                <View style={{ flexDirection: 'row', gap: 32 }}>
                  {acceptance.labels.map(label => (
                    <View key={label} style={{ flex: 1 }}>
                      <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.text, marginBottom: 4, paddingBottom: 20 }} />
                      <Text style={{ fontSize: 7, color: theme.muted }}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

        </View>

        {/* Footer — just a thin line and text */}
        <View style={{ marginTop: 32, borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 10 }}>
          <Text style={{ fontSize: 8, color: theme.muted, textAlign: 'center', letterSpacing: 0.5 }}>
            {footerText ?? 'Thank you for your business.'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
