// ─── Electrician Quoting Module — TypeScript Types ───────────────────────────

// ─── Subscription ────────────────────────────────────────────────────────────

export type SupplierPlan = 'free' | 'quoting'
export type SupplierPlanCategory = 'electrician' | 'plumber' | 'manufacturer'
export type SupplierSubscriptionStatus = 'active' | 'cancelled' | 'past_due'

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ElecSettings {
  id: string
  portal_account_id: string
  cidb_registration_number: string | null
  company_registration_number: string | null
  vat_registration_number: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_branch_code: string | null
  bank_account_type: string | null
  default_vat_rate: number
  default_retention_percentage: number
  default_payment_terms_days: number
  default_defects_liability_days: number
  company_code: string | null
  quote_prefix: string
  claim_prefix: string
  vo_prefix: string
  coc_prefix: string
  email_footer_text: string | null
  created_at: string
  updated_at: string
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export interface ElecClient {
  id: string
  portal_account_id: string
  client_name: string
  company: string | null
  email: string | null
  contact_number: string | null
  vat_number: string | null
  address: string | null
  payment_terms_days: number | null
  notes: string | null
  qs_name: string | null
  qs_email: string | null
  created_at: string
}

// ─── Item Library (autocomplete) ─────────────────────────────────────────────

export type ElecItemType = 'labour' | 'material' | 'both' | 'preliminary' | 'subcontract'

export interface ElecItemLibrary {
  id: string
  portal_account_id: string
  description: string
  unit: string | null
  item_type: ElecItemType
  default_unit_rate: number | null
  default_labour_rate: number | null
  default_material_rate: number | null
  usage_count: number
  created_at: string
  updated_at: string
}

export interface ElecSectionLibrary {
  id: string
  portal_account_id: string
  title: string
  usage_count: number
  created_at: string
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export type ElecQuoteStatus =
  | 'draft'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type ElecProjectType = 'residential' | 'commercial' | 'industrial' | 'retail'
export type ElecContractType = 'lump_sum' | 're_measurement' | 'cost_plus'

export interface ElecQuote {
  id: string
  portal_account_id: string
  client_id: string | null
  quote_number: string
  project_name: string
  project_address: string | null
  description: string | null
  project_type: ElecProjectType | null
  contract_type: ElecContractType
  status: ElecQuoteStatus
  vat_rate: number
  retention_percentage: number
  payment_terms_days: number
  liquidated_damages_per_day: number | null
  defects_liability_period_days: number
  notes: string | null
  quoted_date: string | null
  approved_date: string | null
  expected_completion_date: string | null
  practical_completion_date: string | null
  archived_at: string | null
  share_token: string | null
  share_token_created_at: string | null
  created_at: string
  // Joined
  client?: ElecClient
}

// ─── Project Contacts ─────────────────────────────────────────────────────────

export type ElecContactRole =
  | 'client'
  | 'main_contractor'
  | 'engineer'
  | 'architect'
  | 'site_agent'
  | 'quantity_surveyor'

export interface ElecProjectContact {
  id: string
  quote_id: string
  role: ElecContactRole
  name: string
  company: string | null
  email: string | null
  phone: string | null
  is_billing_contact: boolean
  created_at: string
}

// ─── Quote Sections ───────────────────────────────────────────────────────────

export interface ElecQuoteSection {
  id: string
  quote_id: string
  title: string
  sort_order: number
  created_at: string
  // Joined
  line_items?: ElecQuoteLineItem[]
}

// ─── Quote Line Items ─────────────────────────────────────────────────────────

export interface ElecQuoteLineItem {
  id: string
  quote_id: string
  section_id: string | null
  description: string
  unit: string | null
  item_type: ElecItemType
  drawing_reference: string | null
  subcontractor_name: string | null
  // Original (locked on approval)
  quoted_quantity: number
  quoted_unit_rate: number
  labour_rate: number | null
  material_rate: number | null
  cost_unit_rate: number | null
  markup_percentage: number | null
  // As-built
  as_built_quantity: number | null
  as_built_unit_rate: number | null
  // Variation
  variation_order_id: string | null
  is_variation: boolean
  sort_order: number
  created_at: string
}

// Computed helpers (not stored)
export function lineItemContractValue(item: ElecQuoteLineItem): number {
  return item.quoted_quantity * item.quoted_unit_rate
}

export function lineItemAsBuiltValue(item: ElecQuoteLineItem): number {
  const qty = item.as_built_quantity ?? item.quoted_quantity
  const rate = item.as_built_unit_rate ?? item.quoted_unit_rate
  return qty * rate
}

// ─── Variation Orders ─────────────────────────────────────────────────────────

export type ElecVOStatus = 'pending' | 'approved' | 'rejected'

export interface ElecVariationOrder {
  id: string
  quote_id: string
  vo_number: string
  description: string
  status: ElecVOStatus
  value: number
  requested_by: string | null
  approved_by: string | null
  approved_date: string | null
  notes: string | null
  created_at: string
}

// ─── Claims ───────────────────────────────────────────────────────────────────

export type ElecClaimType = 'invoice' | 'proforma' | 'retention'
export type ElecClaimStatus = 'draft' | 'submitted' | 'certified' | 'invoiced' | 'paid'

export interface ElecClaim {
  id: string
  quote_id: string
  portal_account_id: string
  claim_number: string
  claim_date: string
  period_month: string
  claim_type: ElecClaimType
  status: ElecClaimStatus
  total_claimed: number
  total_certified: number | null
  total_invoiced: number | null
  total_paid: number | null
  sent_to_name: string | null
  sent_to_email: string | null
  qs_name: string | null
  qs_email: string | null
  sent_at: string | null
  notes: string | null
  variation_order_id: string | null
  created_at: string
  // Joined
  line_items?: ElecClaimLineItem[]
  certificate?: ElecCertificate
}

// ─── Claim Line Items ─────────────────────────────────────────────────────────

export interface ElecClaimLineItem {
  id: string
  claim_id: string
  quote_line_item_id: string
  percentage_claimed: number
  amount_claimed: number
  percentage_certified: number | null
  amount_certified: number | null
  notes: string | null
  created_at: string
  // Joined
  quote_line_item?: ElecQuoteLineItem
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export interface ElecCertificate {
  id: string
  claim_id: string
  quote_id: string
  certificate_number: string
  issue_date: string
  certified_amount: number
  issued_by: string | null
  notes: string | null
  created_at: string
}

// ─── Certificate of Compliance (COC) ─────────────────────────────────────────

export interface ElecCOC {
  id: string
  quote_id: string
  coc_number: string
  installation_description: string
  issue_date: string
  tester_name: string
  tester_registration_number: string | null
  valid_until: string | null
  notes: string | null
  created_at: string
}

// ─── Snag Items ───────────────────────────────────────────────────────────────

export type ElecSnagStatus = 'open' | 'in_progress' | 'resolved'

export interface ElecSnagItem {
  id: string
  quote_id: string
  description: string
  status: ElecSnagStatus
  raised_date: string
  resolved_date: string | null
  raised_by: string | null
  notes: string | null
  created_at: string
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export type ElecStaffRole = 'electrician' | 'apprentice' | 'site_foreman' | 'helper' | 'admin'

export interface ElecStaff {
  id: string
  portal_account_id: string
  name: string
  role: ElecStaffRole
  phone: string | null
  email: string | null
  color: string
  is_active: boolean
  created_at: string
}

// ─── Dashboard / Recon types ──────────────────────────────────────────────────

export interface ElecMonthlyRecon {
  period_month: string
  total_claimed: number
  total_certified: number
  total_invoiced: number
  total_paid: number
  balance_outstanding: number
}

export interface ElecJobSummary {
  quote_id: string
  quote_number: string
  project_name: string
  client_name: string | null
  contract_value: number
  total_invoiced: number
  balance_to_invoice: number
  completion_percentage: number
  expected_completion_date: string | null
  status: ElecQuoteStatus
}

export interface ElecDashboardSummary {
  pipeline_count: number
  pipeline_value: number
  active_jobs_count: number
  active_jobs_value: number
  total_invoiced_ytd: number
  total_paid_ytd: number
  forecast_50pct: number  // 50% of pipeline + active value
}
