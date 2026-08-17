import type { Project, LineItem, Client } from '../types'
import { resolveTheme } from './themes'
import { ClassicTemplate } from './templates/Classic'
import { BoldTemplate } from './templates/Bold'
import { MinimalTemplate } from './templates/Minimal'
import type { TemplateProps } from './templates/types'

export type TemplateKey = 'classic' | 'bold' | 'minimal'

interface Props {
  project: Project
  client: Client | null
  lineItems: LineItem[]
  type: 'quote' | 'invoice'
  templateKey?: string | null
  themeKey?: string | null
  vatRate?: number
  depositPct?: number
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

const TEMPLATES: Record<TemplateKey, React.ComponentType<TemplateProps>> = {
  classic: ClassicTemplate,
  bold: BoldTemplate,
  minimal: MinimalTemplate,
}

export function QuotePDF({ templateKey, themeKey, ...rest }: Props) {
  const Template = TEMPLATES[(templateKey as TemplateKey) ?? 'minimal'] ?? MinimalTemplate
  const theme = resolveTheme(themeKey)
  return <Template {...rest} theme={theme} />
}
