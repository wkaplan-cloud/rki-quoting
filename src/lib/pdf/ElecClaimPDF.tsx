import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ElecClaim, ElecQuote, ElecQuoteSection, ElecClient, ElecSettings } from '@/lib/elec-types'

const ACCENT = '#3A7CA5'
const DARK   = '#18181B'
const MUTED  = '#71717A'
const BORDER = '#E4E4E7'
const SURF   = '#F9FAFB'
const AB     = '#EFF6FF'
const GOLD   = '#D9A441'

const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 48, paddingBottom: 64 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, alignItems: 'flex-start' },
  company:     { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 },
  companyMeta: { fontSize: 7, color: MUTED, lineHeight: 1.5 },
  docTitle:    { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, textAlign: 'right' },
  docSub:      { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  docNum:      { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 4 },
  docMeta:     { fontSize: 7.5, color: MUTED, textAlign: 'right', marginTop: 2 },
  infoGrid:    { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoBox:     { flex: 1, padding: 10, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  infoBoxHd:   { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 4, marginBottom: 5 },
  infoBold:    { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
  infoRow:     { fontSize: 8, color: MUTED, marginBottom: 2 },
  draftBanner: { backgroundColor: GOLD, padding: 8, borderRadius: 3, marginBottom: 14 },
  draftText:   { fontSize: 8, color: '#1E2A38', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  tableHead:   { flexDirection: 'row', backgroundColor: ACCENT, paddingVertical: 5, paddingHorizontal: 8, marginTop: 2 },
  th:          { fontSize: 7.5, color: '#FFFFFF', fontFamily: 'Helvetica-Bold' },
  secRow:      { flexDirection: 'row', backgroundColor: AB, paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: BORDER },
  secLabel:    { fontSize: 8, color: ACCENT, fontFamily: 'Helvetica-Bold' },
  row:         { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowAlt:      { backgroundColor: SURF },
  td:          { fontSize: 8.5, color: DARK },
  tdMuted:     { color: MUTED },
  totalsWrap:  { marginTop: 14, alignItems: 'flex-end' },
  totalsBox:   { width: 240, padding: 12, borderWidth: 0.5, borderColor: BORDER, borderRadius: 3 },
  tRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tLabel:      { fontSize: 8, color: MUTED },
  tVal:        { fontSize: 8, color: DARK },
  tDivider:    { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 5 },
  tBig:        { flexDirection: 'row', justifyContent: 'space-between' },
  tBigLabel:   { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT },
  tBigVal:     { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT },
  section:     { marginTop: 16 },
  secTitle:    { fontSize: 6.5, color: ACCENT, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, borderBottomWidth: 0.5, borderBottomColor: BORDER, paddingBottom: 3, marginBottom: 6 },
  secBody:     { fontSize: 8, color: DARK, lineHeight: 1.5 },
  bankRow:     { flexDirection: 'row', gap: 20, marginTop: 4 },
  bankKey:     { fontSize: 6.5, color: MUTED, marginBottom: 1 },
  bankVal:     { fontSize: 8.5, color: DARK, fontFamily: 'Helvetica-Bold' },
  footer:      { position: 'absolute', bottom: 24, left: 48, right: 48, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:  { fontSize: 7, color: MUTED },
})

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
    .toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMonth(yyyyMM01: string) {
  return new Date(yyyyMM01 + 'T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

export interface ClaimLineItemForPDF {
  id: string
  description: string
  section_id: string | null
  contract_value: number
  prev_claimed: number
  this_pct: number
  this_claimed: number
}

export interface ElecClaimPDFProps {
  claim: ElecClaim
  lineItems: ClaimLineItemForPDF[]
  sections: ElecQuoteSection[]
  quote: ElecQuote
  client: ElecClient | null
  settings: ElecSettings | null
  companyName: string
  contractTotal: number
  prevTotalClaimed: number
  logoUrl?: string | null
}

export function ElecClaimPDF({
  claim, lineItems, sections, quote, client, settings, companyName, contractTotal, prevTotalClaimed, logoUrl,
}: ElecClaimPDFProps) {
  const isDraft      = claim.status === 'draft'
  const isRetention  = claim.claim_type === 'retention'
  const isReMeasure  = quote.contract_type === 're_measurement'
  const isCostPlus   = quote.contract_type === 'cost_plus'
  const docTitle     = isRetention
    ? (['invoiced', 'paid'].includes(claim.status) ? 'TAX INVOICE' : 'RETENTION RELEASE')
    : (['invoiced', 'paid'].includes(claim.status) ? 'TAX INVOICE' : 'PAYMENT CLAIM')
  const contractLabel = (isReMeasure || isCostPlus) ? 'Estimated Value' : 'Contract Value'
  const thisClaimed  = claim.total_claimed ?? 0
  const retentionPct = (!isRetention && quote.retention_percentage > 0) ? quote.retention_percentage : 0
  const retentionAmt = retentionPct > 0 ? Math.round(thisClaimed * retentionPct) / 100 : 0
  const netThisClaim = thisClaimed - retentionAmt
  const vatRate      = quote.vat_rate ?? settings?.default_vat_rate ?? 15
  const vatAmount    = thisClaimed * (vatRate / 100)
  const totalPayable = netThisClaim + vatAmount
  const cumulativeTotal = prevTotalClaimed + thisClaimed

  const freeItems = lineItems.filter(li => li.section_id === null)

  const metaParts = [
    settings?.vat_registration_number ? `VAT: ${settings.vat_registration_number}` : null,
    settings?.company_registration_number ? `Reg: ${settings.company_registration_number}` : null,
  ].filter(Boolean).join('  ·  ')

  function LineRows({ list, indent = false }: { list: ClaimLineItemForPDF[]; indent?: boolean }) {
    return (
      <>
        {list.map((li, i) => {
          const cumulative = li.prev_claimed + li.this_claimed
          return (
            <View key={li.id} style={[s.row, i % 2 !== 0 ? s.rowAlt : {}]} wrap={false}>
              <Text style={[s.td, { flex: 1, paddingRight: 4, paddingLeft: indent ? 8 : 0 }]}>{li.description || '—'}</Text>
              <Text style={[s.td, s.tdMuted, { width: 75, textAlign: 'right' }]}>{fmtR(li.contract_value)}</Text>
              <Text style={[s.td, s.tdMuted, { width: 65, textAlign: 'right' }]}>{fmtR(li.prev_claimed)}</Text>
              <Text style={[s.td, { width: 65, textAlign: 'right', color: ACCENT }]}>
                {li.this_pct > 0 ? `${li.this_pct}%` : '—'}
              </Text>
              <Text style={[s.td, { width: 75, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: ACCENT }]}>
                {fmtR(li.this_claimed)}
              </Text>
              <Text style={[s.td, { width: 75, textAlign: 'right' }]}>{fmtR(cumulative)}</Text>
            </View>
          )
        })}
      </>
    )
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Draft watermark banner */}
        {isDraft && (
          <View style={s.draftBanner}>
            <Text style={s.draftText}>DRAFT — NOT FOR PAYMENT</Text>
          </View>
        )}

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {logoUrl
              ? <Image src={logoUrl} style={{ maxWidth: 180, maxHeight: 52, alignSelf: 'flex-start', marginBottom: metaParts ? 4 : 0 }} />
              : <Text style={s.company}>{companyName}</Text>
            }
            {metaParts ? <Text style={s.companyMeta}>{metaParts}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.docTitle}>{docTitle}</Text>
            <Text style={s.docSub}>Progress Claim</Text>
            <Text style={s.docNum}>{claim.claim_number}</Text>
            <Text style={s.docMeta}>Date: {fmtDate(claim.claim_date)}</Text>
            <Text style={s.docMeta}>Period: {fmtMonth(claim.period_month)}</Text>
          </View>
        </View>

        {/* To / Claim Details */}
        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>TO</Text>
            {claim.sent_to_name  && <Text style={s.infoBold}>{claim.sent_to_name}</Text>}
            {claim.sent_to_email && <Text style={s.infoRow}>{claim.sent_to_email}</Text>}
            {!claim.sent_to_name && client && (
              <>
                <Text style={s.infoBold}>{client.client_name}</Text>
                {client.company    && <Text style={s.infoRow}>{client.company}</Text>}
                {client.email      && <Text style={s.infoRow}>{client.email}</Text>}
                {client.vat_number && <Text style={s.infoRow}>VAT: {client.vat_number}</Text>}
              </>
            )}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoBoxHd}>CONTRACT DETAILS</Text>
            <Text style={s.infoBold}>{quote.project_name}</Text>
            {quote.project_address && <Text style={s.infoRow}>{quote.project_address}</Text>}
            <Text style={s.infoRow}>{contractLabel}: {fmtR(contractTotal)}</Text>
            {(isReMeasure || isCostPlus) && (
              <Text style={[s.infoRow, { color: MUTED }]}>
                {isReMeasure ? 'Re-measurement' : 'Cost-plus'} contract — final value based on actuals
              </Text>
            )}
            {quote.retention_percentage > 0 && !isRetention && (
              <Text style={s.infoRow}>Retention: {quote.retention_percentage}%</Text>
            )}
          </View>
        </View>

        {/* Line items table — skipped for retention claims */}
        {isRetention ? (
          <View style={{ marginTop: 8, padding: 14, borderWidth: 0.5, borderColor: GOLD, borderRadius: 3, backgroundColor: '#FFFBF0' }}>
            <Text style={{ fontSize: 7.5, color: GOLD, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 6 }}>
              RETENTION RELEASE
            </Text>
            <Text style={{ fontSize: 9, color: DARK, marginBottom: 3 }}>
              Release of retention held in terms of the contract.
            </Text>
            {claim.notes ? (
              <Text style={{ fontSize: 8, color: MUTED }}>{claim.notes}</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 1 }]}>Description</Text>
              <Text style={[s.th, { width: 75, textAlign: 'right' }]}>{contractLabel}</Text>
              <Text style={[s.th, { width: 65, textAlign: 'right' }]}>Prev Claimed</Text>
              <Text style={[s.th, { width: 65, textAlign: 'right' }]}>This %</Text>
              <Text style={[s.th, { width: 75, textAlign: 'right' }]}>This Claim</Text>
              <Text style={[s.th, { width: 75, textAlign: 'right' }]}>Total To Date</Text>
            </View>

            <LineRows list={freeItems} />

            {sections.map(sec => {
              const secItems = lineItems.filter(li => li.section_id === sec.id)
              if (secItems.length === 0) return null
              const secThisClaim = secItems.reduce((sum, li) => sum + li.this_claimed, 0)
              return (
                <View key={sec.id}>
                  <View style={s.secRow} wrap={false}>
                    <Text style={[s.secLabel, { flex: 1 }]}>{sec.title || 'Untitled Section'}</Text>
                    <Text style={[s.secLabel, { width: 75, textAlign: 'right' }]}>{fmtR(secThisClaim)}</Text>
                  </View>
                  <LineRows list={secItems} indent />
                </View>
              )
            })}
          </>
        )}

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            {!isRetention && (
              <>
                <View style={s.tRow}>
                  <Text style={s.tLabel}>Previously claimed</Text>
                  <Text style={s.tVal}>{fmtR(prevTotalClaimed)}</Text>
                </View>
                <View style={s.tRow}>
                  <Text style={s.tLabel}>Cumulative to date</Text>
                  <Text style={s.tVal}>{fmtR(cumulativeTotal)}</Text>
                </View>
                <View style={s.tDivider} />
              </>
            )}
            <View style={s.tRow}>
              <Text style={s.tLabel}>This claim (excl. VAT)</Text>
              <Text style={s.tVal}>{fmtR(thisClaimed)}</Text>
            </View>
            {retentionAmt > 0 && (
              <>
                <View style={s.tRow}>
                  <Text style={[s.tLabel, { color: GOLD }]}>Less retention ({retentionPct}%)</Text>
                  <Text style={[s.tVal, { color: GOLD }]}>– {fmtR(retentionAmt)}</Text>
                </View>
                <View style={s.tRow}>
                  <Text style={s.tLabel}>Net this claim (excl. VAT)</Text>
                  <Text style={s.tVal}>{fmtR(netThisClaim)}</Text>
                </View>
              </>
            )}
            <View style={s.tRow}>
              <Text style={s.tLabel}>VAT ({vatRate}%)</Text>
              <Text style={s.tVal}>{fmtR(vatAmount)}</Text>
            </View>
            <View style={s.tDivider} />
            <View style={s.tBig}>
              <Text style={s.tBigLabel}>TOTAL PAYABLE</Text>
              <Text style={s.tBigVal}>{fmtR(totalPayable)}</Text>
            </View>
          </View>
        </View>

        {/* Bank details */}
        {(settings?.bank_name || settings?.bank_account_number) && (
          <View style={s.section}>
            <Text style={s.secTitle}>BANKING DETAILS</Text>
            <View style={s.bankRow}>
              {settings?.bank_name           && <View><Text style={s.bankKey}>Bank</Text><Text style={s.bankVal}>{settings.bank_name}</Text></View>}
              {settings?.bank_account_number && <View><Text style={s.bankKey}>Account</Text><Text style={s.bankVal}>{settings.bank_account_number}</Text></View>}
              {settings?.bank_branch_code    && <View><Text style={s.bankKey}>Branch Code</Text><Text style={s.bankVal}>{settings.bank_branch_code}</Text></View>}
              {settings?.bank_account_type   && <View><Text style={s.bankKey}>Account Type</Text><Text style={s.bankVal}>{settings.bank_account_type}</Text></View>}
            </View>
            {quote.payment_terms_days > 0 && (
              <Text style={[s.secBody, { marginTop: 6 }]}>Payment due within {quote.payment_terms_days} days of invoice date.</Text>
            )}
          </View>
        )}

        {/* Notes */}
        {claim.notes && (
          <View style={s.section}>
            <Text style={s.secTitle}>NOTES</Text>
            <Text style={s.secBody}>{claim.notes}</Text>
          </View>
        )}

        {settings?.email_footer_text && (
          <View style={s.section}>
            <Text style={s.secBody}>{settings.email_footer_text}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>{claim.claim_number} — {quote.project_name}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
