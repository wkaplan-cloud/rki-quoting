import type { Project, LineItem, Client } from '@/lib/types'
import type { PdfTheme } from '../themes'

export interface TemplateProps {
  project: Project
  client: Client | null
  lineItems: LineItem[]
  type: 'quote' | 'invoice'
  theme: PdfTheme
  vatRate?: number
  depositPct?: number
  /** Actual rand amount already paid by the client. Invoices only — shown as "Deposit Received". */
  amountPaid?: number
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
  /** Base64 data URIs keyed by line item id. Empty when images are switched off. */
  itemImages?: Record<string, string>
}
