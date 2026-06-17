import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { MfgSettings, MfgQuoteLineItem } from '@/lib/mfg-types'

const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const RED    = '#DC2626'
const GREEN  = '#16A34A'

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export interface MfgPDFProps {
  documentType: 'quote' | 'invoice' | 'deposit_invoice' | 'final_invoice'
  quoteNumber?: string
  invoiceNumber?: string
  revisionNumber?: number
  status?: string
  date: string
  validUntil?: string | null
  dueDate?: string | null
  // Client / job
  clientName: string
  clientType: 'individual' | 'company'
  contactPerson?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  clientAddress?: string | null
  clientVatNumber?: string | null
  jobName: string
  // Sender (prepared by)
  sentByName?: string | null
  sentByEmail?: string | null
  sentByPhone?: string | null
  // Line items
  lineItems: MfgQuoteLineItem[]
  subtotal: number
  vatAmount: number
  total: number
  applyVat: boolean
  vatRate: number
  deliveryCost?: number
  installationCost?: number
  // Deposit invoice specifics
  fullProjectTotal?: number
  depositPercentage?: number
  // Settings
  settings: MfgSettings | null
  logoBase64?: string | null
  showUnitPrice?: boolean
}

function makeStyles(accent: string) {
  return StyleSheet.create({
    page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 36, paddingBottom: 56 },
    header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' },
    logo:        { maxHeight: 40, maxWidth: 110, objectFit: 'contain', marginBottom: 4 },
    companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
    companyMeta: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
    docTitle:    { fontSize: 20, fontFamily: 'Helvetica-Bold', color: accent, textAlign: 'right' },
    docNum:      { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 3 },
    docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
    divider:     { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 8 },
    infoGrid:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
    infoBox:     { flex: 1, padding: 8, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
    infoHead:    { fontSize: 6.5, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 4 },
    infoBold:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 1.5 },
    infoRow:     { fontSize: 7.5, color: MUTED, marginBottom: 1 },
    jobLabel:    { fontSize: 6.5, color: MUTED, letterSpacing: 0.5, marginBottom: 2 },
    jobName:     { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 10 },
    tableHead:   { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, marginBottom: 1 },
    th:          { fontSize: 7, color: MUTED, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },
    row:         { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
    rowAlt:      { backgroundColor: SURF },
    itemNum:     { width: 18, fontSize: 8, color: accent, fontFamily: 'Helvetica-Bold' },
    desc:        { flex: 1, fontSize: 8.5, color: DARK, lineHeight: 1.4 },
    callout:     { fontSize: 7.5, color: RED, marginTop: 2, lineHeight: 1.4 },
    qty:         { width: 36, fontSize: 8.5, color: DARK, textAlign: 'center' },
    amt:         { width: 72, fontSize: 8.5, color: DARK, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
    totalsWrap:  { marginTop: 8, alignItems: 'flex-end' },
    totalsBox:   { width: 240, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
    tRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    tLabel:      { fontSize: 8, color: MUTED },
    tVal:        { fontSize: 8, color: DARK },
    tDivider:    { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 4 },
    tBig:        { flexDirection: 'row', justifyContent: 'space-between' },
    tBigLabel:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: accent },
    tBigVal:     { fontSize: 10, fontFamily: 'Helvetica-Bold', color: accent },
    bankBox:     { marginTop: 10, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3, backgroundColor: SURF },
    bankHead:    { fontSize: 6.5, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 6 },
    bankGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    bankItem:    { minWidth: 80 },
    bankKey:     { fontSize: 6, color: MUTED, marginBottom: 1.5 },
    bankVal:     { fontSize: 8.5, color: DARK, fontFamily: 'Helvetica-Bold' },
    acceptBox:   { marginTop: 10, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
    acceptText:  { fontSize: 8, color: DARK, lineHeight: 1.5, marginBottom: 8 },
    sigLine:     { flexDirection: 'row', gap: 24 },
    sigItem:     { flex: 1 },
    sigLineBar:  { borderBottomWidth: 0.5, borderBottomColor: DARK, marginBottom: 3, height: 14 },
    sigLabel:    { fontSize: 7, color: MUTED },
    tcHead:      { fontSize: 6.5, color: accent, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 4, marginTop: 10 },
    tcBody:      { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
    optSection:  { marginTop: 8, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6 },
    optHead:     { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    optLabel:    { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 2 },
    optSub:      { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 8, paddingVertical: 3, borderTopWidth: 0.5, borderTopColor: BORDER },
    optSubLabel: { fontSize: 7.5, color: MUTED, marginRight: 8 },
    optSubVal:   { width: 72, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
    optsDivider: { marginTop: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
    footer:      { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
    footTxt:     { fontSize: 7, color: MUTED },
    depNote:     { marginTop: 8, padding: 8, borderWidth: 0.5, borderColor: '#FDE68A', borderRadius: 3, backgroundColor: '#FFFBEB' },
    depNoteText: { fontSize: 8, color: '#92400E', lineHeight: 1.4 },
  })
}

export function MfgQuotePDF(props: MfgPDFProps) {
  const {
    documentType, quoteNumber, invoiceNumber, revisionNumber, date, validUntil, dueDate,
    clientName, clientType, contactPerson, clientEmail, clientPhone, clientAddress, clientVatNumber,
    jobName, sentByName, sentByEmail, sentByPhone,
    lineItems, subtotal, vatAmount, total, applyVat, vatRate,
    deliveryCost, installationCost,
    fullProjectTotal, depositPercentage,
    settings, logoBase64, showUnitPrice,
  } = props

  const accent = settings?.accent_color ?? '#1B4F8A'
  const s = makeStyles(accent)

  const isInvoice = documentType !== 'quote'
  const docLabel = documentType === 'quote' ? 'QUOTATION' : 'INVOICE'
  const docNumber = isInvoice ? invoiceNumber : quoteNumber

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            {logoBase64 && <Image src={logoBase64} style={s.logo} />}
            <Text style={s.companyName}>{settings?.business_name ?? 'Your Business'}</Text>
            <Text style={s.companyMeta}>
              {[settings?.address, settings?.phone, settings?.email].filter(Boolean).join('\n')}
              {settings?.vat_registered && settings?.vat_registration_number ? `\nVAT Reg: ${settings.vat_registration_number}` : ''}
              {settings?.company_registration_number ? `\nReg No: ${settings.company_registration_number}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>{docLabel}</Text>
            <Text style={s.docNum}>{docNumber}{revisionNumber && revisionNumber > 1 ? ` — Revision ${revisionNumber}` : ''}</Text>
            <Text style={s.docMeta}>Date: {fmtDate(date)}</Text>
            {!isInvoice && validUntil && <Text style={s.docMeta}>Valid until: {fmtDate(validUntil)}</Text>}
            {isInvoice && dueDate && <Text style={s.docMeta}>Due: {fmtDate(dueDate)}</Text>}
            {sentByName && <Text style={s.docMeta}>Prepared by: {sentByName}{sentByPhone ? ` · ${sentByPhone}` : ''}</Text>}
          </View>
        </View>

        <View style={s.divider} />

        {/* Client + Job */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoHead}>PREPARED FOR</Text>
            <Text style={s.infoBold}>{clientName}</Text>
            {clientType === 'company' && contactPerson && <Text style={s.infoRow}>{contactPerson}</Text>}
            {clientAddress && <Text style={s.infoRow}>{clientAddress}</Text>}
            {clientEmail && <Text style={s.infoRow}>{clientEmail}</Text>}
            {clientPhone && <Text style={s.infoRow}>{clientPhone}</Text>}
            {clientVatNumber && <Text style={s.infoRow}>VAT: {clientVatNumber}</Text>}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoHead}>JOB</Text>
            <Text style={[s.infoBold, { fontSize: 10 }]}>{jobName}</Text>
          </View>
        </View>

        {/* Deposit note */}
        {documentType === 'deposit_invoice' && fullProjectTotal !== undefined && depositPercentage !== undefined && (
          <View style={s.depNote}>
            <Text style={s.depNoteText}>
              This invoice covers the {depositPercentage}% deposit required to commence work on this project.{'\n'}
              Full project value: {fmtR(fullProjectTotal)} · Balance invoice on completion: {fmtR(fullProjectTotal - total)}
            </Text>
          </View>
        )}

        {/* Line items */}
        {(() => {
          const hasOptions  = lineItems.some(li => !!li.option_label)
          const baseItems   = lineItems.filter(li => !li.option_label)
          const baseSubtotal = baseItems.reduce((s, li) => s + li.line_total, 0)

          // Pre-compute subtotal at the end of each contiguous optional block
          const blockEndSubtotal: Record<number, number> = {}
          let blockSum = 0
          let inBlock = false
          for (let i = 0; i <= lineItems.length; i++) {
            const isOpt = i < lineItems.length && !!lineItems[i].option_label
            if (isOpt) { inBlock = true; blockSum += lineItems[i].line_total }
            else if (inBlock) { blockEndSubtotal[i - 1] = blockSum; blockSum = 0; inBlock = false }
          }

          return (
            <>
              <View style={[s.tableHead, { marginTop: 8 }]}>
                <Text style={[s.th, { width: 18 }]}>#</Text>
                <Text style={[s.th, { flex: 1 }]}>DESCRIPTION</Text>
                <Text style={[s.th, { width: showUnitPrice ? 28 : 36, textAlign: 'center' }]}>QTY</Text>
                {showUnitPrice && <Text style={[s.th, { width: 64, textAlign: 'right' }]}>UNIT PRICE</Text>}
                <Text style={[s.th, { width: showUnitPrice ? 64 : 72, textAlign: 'right' }]}>TOTAL</Text>
              </View>

              {lineItems.map((li, idx) => {
                const prevIsOpt = idx > 0 && !!lineItems[idx - 1].option_label
                const isFirstInBlock = !!li.option_label && !prevIsOpt
                const isLastInBlock  = blockEndSubtotal[idx] !== undefined
                const baseAltIdx     = baseItems.indexOf(li)
                return (
                  <React.Fragment key={li.id ?? idx}>
                    {isFirstInBlock && (
                      <View style={s.optSection}>
                        <View style={s.optHead}>
                          <Text style={[s.optLabel, { backgroundColor: '#DBEAFE', color: accent }]}>SELECT AN OPTION</Text>
                        </View>
                      </View>
                    )}
                    <View style={[s.row, li.option_label ? { backgroundColor: '#F0F7FF' } : (baseAltIdx % 2 === 1 ? s.rowAlt : {})]} wrap={false}>
                      <Text style={[s.itemNum, li.option_label ? { color: accent } : {}]}>{idx + 1}</Text>
                      <View style={s.desc}>
                        <Text>{li.description}</Text>
                        {li.callout_note && <Text style={s.callout}>⚠ {li.callout_note}</Text>}
                      </View>
                      <Text style={[s.qty, { width: showUnitPrice ? 28 : 36 }]}>{li.quantity}</Text>
                      {showUnitPrice && <Text style={[s.amt, { width: 64 }]}>{li.unit_price > 0 ? fmtR(li.unit_price) : 'TBC'}</Text>}
                      <Text style={[s.amt, { width: showUnitPrice ? 64 : 72 }]}>{li.line_total > 0 ? fmtR(li.line_total) : 'TBC'}</Text>
                    </View>
                    {isLastInBlock && (
                      <View style={s.optSub}>
                        <Text style={s.optSubLabel}>Option subtotal</Text>
                        <Text style={[s.optSubVal, { color: accent }]}>{fmtR(blockEndSubtotal[idx])}</Text>
                      </View>
                    )}
                  </React.Fragment>
                )
              })}

              {hasOptions && <View style={s.optsDivider} />}

              {/* Totals */}
              {(() => {
                const effectiveDelivery     = deliveryCost ?? 0
                const effectiveInstallation = installationCost ?? 0
                const hasExtras = effectiveDelivery > 0 || effectiveInstallation > 0
                const itemsBase  = hasOptions ? baseSubtotal : subtotal
                const grossBase  = itemsBase + effectiveDelivery + effectiveInstallation
                const baseVatAdj = applyVat ? grossBase * (vatRate / 100) : 0
                const baseGrand  = grossBase + baseVatAdj
                return (
                  <View style={s.totalsWrap} wrap={false}>
                    <View style={s.totalsBox}>
                      <View style={s.tRow}>
                        <Text style={s.tLabel}>{hasOptions ? 'Base items subtotal' : (hasExtras ? 'Items subtotal' : 'Subtotal')}</Text>
                        <Text style={s.tVal}>{fmtR(itemsBase)}</Text>
                      </View>
                      {hasOptions && (
                        <View style={s.tRow}>
                          <Text style={[s.tLabel, { fontStyle: 'italic' }]}>Options — please select one</Text>
                          <Text style={[s.tLabel, { fontStyle: 'italic' }]}>see above</Text>
                        </View>
                      )}
                      {effectiveDelivery > 0 && (
                        <View style={s.tRow}>
                          <Text style={s.tLabel}>Delivery</Text>
                          <Text style={s.tVal}>{fmtR(effectiveDelivery)}</Text>
                        </View>
                      )}
                      {effectiveInstallation > 0 && (
                        <View style={s.tRow}>
                          <Text style={s.tLabel}>Installation</Text>
                          <Text style={s.tVal}>{fmtR(effectiveInstallation)}</Text>
                        </View>
                      )}
                      {hasExtras && (
                        <View style={s.tRow}>
                          <Text style={[s.tLabel, { fontFamily: 'Helvetica-Bold' }]}>Subtotal</Text>
                          <Text style={[s.tVal, { fontFamily: 'Helvetica-Bold' }]}>{fmtR(grossBase)}</Text>
                        </View>
                      )}
                      {applyVat && (
                        <View style={s.tRow}>
                          <Text style={s.tLabel}>VAT ({vatRate}%)</Text>
                          <Text style={s.tVal}>{fmtR(hasOptions ? baseVatAdj : vatAmount)}</Text>
                        </View>
                      )}
                      <View style={s.tDivider} />
                      <View style={s.tBig}>
                        <Text style={s.tBigLabel}>{hasOptions ? 'BASE TOTAL' : 'TOTAL'}</Text>
                        <Text style={s.tBigVal}>{fmtR(hasOptions ? baseGrand : total)}</Text>
                      </View>
                      {hasOptions && (
                        <View style={[s.tRow, { marginTop: 6 }]}>
                          <Text style={[s.tLabel, { fontSize: 7 }]}>+ Add your chosen option total</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )
              })()}
            </>
          )
        })()}

        {/* Banking details */}
        {(settings?.bank_name || settings?.bank_account_number) && (
          <View style={s.bankBox} wrap={false}>
            <Text style={s.bankHead}>BANKING DETAILS</Text>
            <View style={s.bankGrid}>
              {settings?.bank_name && (
                <View style={s.bankItem}>
                  <Text style={s.bankKey}>BANK</Text>
                  <Text style={s.bankVal}>{settings.bank_name}</Text>
                </View>
              )}
              {settings?.bank_account_holder && (
                <View style={s.bankItem}>
                  <Text style={s.bankKey}>ACCOUNT HOLDER</Text>
                  <Text style={s.bankVal}>{settings.bank_account_holder}</Text>
                </View>
              )}
              {settings?.bank_account_number && (
                <View style={s.bankItem}>
                  <Text style={s.bankKey}>ACCOUNT NUMBER</Text>
                  <Text style={s.bankVal}>{settings.bank_account_number}</Text>
                </View>
              )}
              {settings?.bank_branch_code && (
                <View style={s.bankItem}>
                  <Text style={s.bankKey}>BRANCH CODE</Text>
                  <Text style={s.bankVal}>{settings.bank_branch_code}</Text>
                </View>
              )}
              <View style={s.bankItem}>
                <Text style={s.bankKey}>REFERENCE</Text>
                <Text style={s.bankVal}>{docNumber}{isInvoice ? '' : ' (deposit)'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Acceptance block (quotes only) */}
        {!isInvoice && (
          <View style={s.acceptBox} wrap={false}>
            <Text style={s.acceptText}>
              By signing below, or by making payment of the deposit, you confirm acceptance of this quotation and agreement to the terms and conditions below.
            </Text>
            <View style={s.sigLine}>
              <View style={s.sigItem}>
                <View style={s.sigLineBar} />
                <Text style={s.sigLabel}>Signature</Text>
              </View>
              <View style={s.sigItem}>
                <View style={s.sigLineBar} />
                <Text style={s.sigLabel}>Name</Text>
              </View>
              <View style={s.sigItem}>
                <View style={s.sigLineBar} />
                <Text style={s.sigLabel}>Date</Text>
              </View>
            </View>
          </View>
        )}

        {/* T&Cs */}
        {settings?.terms_and_conditions && (
          <View>
            <Text style={s.tcHead}>TERMS & CONDITIONS</Text>
            <Text style={s.tcBody}>{settings.terms_and_conditions}</Text>
          </View>
        )}

        {/* Default payment terms if no full T&Cs */}
        {!settings?.terms_and_conditions && settings?.default_payment_terms && (
          <View>
            <Text style={s.tcHead}>PAYMENT TERMS</Text>
            <Text style={s.tcBody}>{settings.default_payment_terms}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footTxt}>{settings?.business_name ?? ''}</Text>
          <Text style={s.footTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
