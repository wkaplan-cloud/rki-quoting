import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { formatZAR } from '@/lib/quoting'
import type { Statement } from '@/lib/statement'
import type { PdfTheme } from './themes'

interface Props {
  statement: Statement
  theme: PdfTheme
  /** Statement date, YYYY-MM-DD (South African "today"). */
  asAt: string
  logoUrl?: string | null
  businessName?: string | null
  businessAddress?: string | null
  vatNumber?: string | null
  companyReg?: string | null
  bankName?: string | null
  bankAccount?: string | null
  bankBranch?: string | null
  footerText?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Signed rands: a credit (client paid more than owed) reads as "-R 1 000,00". */
const signedZAR = (n: number) => (n < 0 ? `-${formatZAR(-n)}` : formatZAR(n))

export function StatementPDF({ statement, theme, asAt, logoUrl, businessName, businessAddress, vatNumber, companyReg, bankName, bankAccount, bankBranch, footerText }: Props) {
  const { client, projects } = statement
  const label = { fontSize: 7, color: theme.muted, letterSpacing: 1.5, marginBottom: 8 }
  const colHead = { fontSize: 7.5, color: theme.muted, letterSpacing: 1 }

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 9, color: theme.text, padding: 56, flexDirection: 'column' }}>
        <View style={{ flex: 1 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              {logoUrl
                ? <View style={{ alignItems: 'flex-start' }}><Image src={logoUrl} style={{ maxWidth: 240, maxHeight: 56, objectFit: 'contain' }} /></View>
                : <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.3 }}>{businessName || 'Studio'}</Text>
              }
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: 2 }}>STATEMENT</Text>
              <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: theme.primary, marginTop: 2 }}>{formatDate(asAt)}</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: theme.primary, marginBottom: 28 }} />

          {/* Client left, balance right */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
            <View style={{ flex: 1 }}>
              <Text style={label}>STATEMENT FOR</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{client.client_name}</Text>
              {client.company && <Text style={{ fontSize: 8.5, color: theme.text, marginTop: 3 }}>{client.company}</Text>}
              {client.vat_number && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>VAT: {client.vat_number}</Text>}
              {client.address && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.address}</Text>}
              {client.email && <Text style={{ fontSize: 8, color: theme.muted, marginTop: 2 }}>{client.email}</Text>}
            </View>
            <View style={{ width: 200, alignItems: 'flex-end' }}>
              <Text style={label}>BALANCE DUE</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{signedZAR(statement.balance)}</Text>
              {businessAddress ? <Text style={{ fontSize: 7.5, color: theme.muted, marginTop: 10, textAlign: 'right' }}>{businessAddress.replace(/\n/g, ', ')}</Text> : null}
              {(vatNumber || companyReg) ? (
                <Text style={{ fontSize: 7, color: theme.muted, marginTop: 3 }}>
                  {[vatNumber ? `VAT: ${vatNumber}` : null, companyReg ? `Reg: ${companyReg}` : null].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Table */}
          <View style={{ flexDirection: 'row', paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: theme.primary }}>
            <Text style={{ ...colHead, width: 70 }}>DATE</Text>
            <Text style={{ ...colHead, flex: 1 }}>DESCRIPTION</Text>
            <Text style={{ ...colHead, width: 80, textAlign: 'right' }}>CHARGED</Text>
            <Text style={{ ...colHead, width: 80, textAlign: 'right' }}>PAID</Text>
          </View>

          {projects.length === 0 ? (
            <Text style={{ fontSize: 9, color: theme.muted, paddingVertical: 12 }}>Nothing outstanding.</Text>
          ) : projects.map(p => (
            <View key={p.id} wrap={false} style={{ paddingTop: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
                <Text style={{ fontSize: 8.5, width: 70, color: theme.text }}>{p.invoiced_date ? formatDate(p.invoiced_date) : '—'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{p.project_number} · {p.project_name}</Text>
                  <Text style={{ fontSize: 7.5, color: theme.muted, marginTop: 1 }}>{p.invoiced_date ? 'Invoice' : 'Accepted quote, not yet invoiced'}</Text>
                </View>
                <Text style={{ fontSize: 9, width: 80, textAlign: 'right', color: theme.text }}>{formatZAR(p.total)}</Text>
                <Text style={{ fontSize: 9, width: 80 }} />
              </View>
              {p.payments.map(pay => (
                <View key={pay.key} style={{ flexDirection: 'row', paddingVertical: 2 }}>
                  <Text style={{ fontSize: 8.5, width: 70, color: theme.text }}>{pay.paid_on ? formatDate(pay.paid_on) : ''}</Text>
                  <Text style={{ fontSize: 8.5, flex: 1, color: theme.muted }}>{pay.label}</Text>
                  <Text style={{ fontSize: 9, width: 80 }} />
                  <Text style={{ fontSize: 9, width: 80, textAlign: 'right', color: theme.accent }}>{formatZAR(pay.amount)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                <Text style={{ fontSize: 8, color: theme.muted, marginRight: 12 }}>Balance</Text>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: theme.primary, width: 80, textAlign: 'right' }}>{signedZAR(p.balance)}</Text>
              </View>
            </View>
          ))}

          {/* Totals */}
          <View wrap={false} style={{ marginTop: 16, alignSelf: 'flex-end', width: 240 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ fontSize: 8, color: theme.muted }}>Total charged</Text>
              <Text style={{ fontSize: 8, color: theme.text }}>{formatZAR(statement.total)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
              <Text style={{ fontSize: 8, color: theme.muted }}>Total paid</Text>
              <Text style={{ fontSize: 8, color: theme.accent }}>{statement.paid > 0 ? `-${formatZAR(statement.paid)}` : formatZAR(0)}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: theme.primary, marginTop: 4, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: theme.primary, letterSpacing: 0.5 }}>BALANCE DUE</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.primary }}>{signedZAR(statement.balance)}</Text>
            </View>
          </View>

          {(bankName || bankAccount) ? (
            <View wrap={false} style={{ marginTop: 28 }}>
              <Text style={label}>BANKING DETAILS</Text>
              {bankName ? <Text style={{ fontSize: 8, color: theme.text }}>{bankName}</Text> : null}
              {bankAccount ? <Text style={{ fontSize: 8, color: theme.text, marginTop: 2 }}>Account: {bankAccount}</Text> : null}
              {bankBranch ? <Text style={{ fontSize: 8, color: theme.text, marginTop: 2 }}>Branch code: {bankBranch}</Text> : null}
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 32, borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 10 }}>
          <Text style={{ fontSize: 8, color: theme.muted, textAlign: 'center', letterSpacing: 0.5 }}>
            {footerText ?? 'Thank you for your business.'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
