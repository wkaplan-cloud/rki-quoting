// ─── Manufacturing Quoting Module — TypeScript Types ─────────────────────────

// ─── Roles & Status Unions ────────────────────────────────────────────────────

export type MfgTeamRole = 'admin' | 'team_member'
export type MfgTeamStatus = 'invited' | 'active' | 'inactive'
export type MfgClientType = 'individual' | 'company'
export type MfgPriceBookItemType = 'material' | 'hardware'
export type MfgPriceBookUnit = 'sheet' | 'plank' | 'meter' | 'piece' | 'litre' | 'kg' | 'custom'
export type MfgQuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'invoiced' | 'superseded'
export type MfgInvoiceType = 'full' | 'deposit' | 'final'
export type MfgInvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue'
export type MfgPaymentMethod = 'eft' | 'cash' | 'card' | 'other'
export type MfgActivityEntityType = 'quote' | 'invoice'

export type MfgMaterialCategory = 'boards' | 'solid_timber' | 'acrylic_specialty'
export type MfgHardwareCategory =
  | 'glass_mirrors'
  | 'hinges_rails'
  | 'handles_fittings'
  | 'stone_steel'
  | 'finishes_oils'
  | 'lighting'

export type MfgPriceBookCategory = MfgMaterialCategory | MfgHardwareCategory

// ─── Team Members ─────────────────────────────────────────────────────────────

export interface MfgTeamMember {
  id: string
  portal_account_id: string
  auth_user_id: string | null
  name: string
  email: string
  role: MfgTeamRole
  status: MfgTeamStatus
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  created_at: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface MfgSettings {
  id: string
  portal_account_id: string
  business_name: string | null
  logo_url: string | null
  address: string | null
  email: string | null
  phone: string | null
  company_registration_number: string | null
  vat_registered: boolean
  vat_registration_number: string | null
  bank_name: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_branch_code: string | null
  bank_account_type: string | null
  default_vat_rate: number
  default_markup_percentage: number
  quote_validity_days: number
  default_deposit_percentage: number
  default_payment_terms: string | null
  terms_and_conditions: string | null
  quote_prefix: string
  invoice_prefix: string
  quote_number_seed: number
  invoice_number_seed: number
  accent_color: string | null
  email_template_quote: string | null
  email_template_invoice: string | null
  created_at: string
  updated_at: string
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export interface MfgClient {
  id: string
  portal_account_id: string
  client_type: MfgClientType
  client_name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  vat_number: string | null
  notes: string | null
  referred_by: string | null
  archived_at: string | null
  created_at: string
}

// Extended with computed fields for list/detail views
export interface MfgClientWithStats extends MfgClient {
  total_revenue: number
  outstanding_balance: number
  job_count: number
  last_active_at: string | null
}

// ─── Price Book ───────────────────────────────────────────────────────────────

export interface MfgPriceBookItem {
  id: string
  portal_account_id: string
  item_type: MfgPriceBookItemType
  category: MfgPriceBookCategory
  name: string
  unit: MfgPriceBookUnit
  unit_custom: string | null
  cost_price: number | null       // null when supplier_quoted = true
  supplier_quoted: boolean
  apply_markup_default: boolean
  supplier_name: string | null
  supplier_contact: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export interface MfgJob {
  id: string
  portal_account_id: string
  client_id: string | null
  job_name: string
  description: string | null
  archived_at: string | null
  created_at: string
}

export interface MfgJobWithClient extends MfgJob {
  client: MfgClient | null
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export interface MfgQuote {
  id: string
  portal_account_id: string
  job_id: string
  quote_number: string
  revision_number: number
  status: MfgQuoteStatus
  apply_vat: boolean
  vat_rate: number
  show_unit_price: boolean
  valid_until: string | null
  notes: string | null
  sent_to_email: string | null
  sent_at: string | null
  sent_by_name: string | null
  sent_by_email: string | null
  sent_by_phone: string | null
  acceptance_date: string | null
  subtotal: number
  vat_amount: number
  total: number
  total_cost: number
  total_profit: number
  delivery_cost: number
  installation_cost: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface MfgQuoteWithJob extends MfgQuote {
  job: MfgJobWithClient
}

// Full quote with all line items and cost builds — used for quote builder and PDF
export interface MfgQuoteFull extends MfgQuoteWithJob {
  line_items: MfgQuoteLineItemFull[]
}

// ─── Quote Line Items ─────────────────────────────────────────────────────────

export interface MfgQuoteLineItem {
  id: string
  quote_id: string
  sort_order: number
  description: string
  callout_note: string | null
  quantity: number
  unit_price: number
  line_total: number
  markup_percentage: number
  cost_per_unit: number
  profit_per_unit: number
  margin_percentage: number
  option_label: string | null
  labour_hours: number
  labour_rate: number
  created_at: string
  updated_at: string
}

export interface MfgQuoteLineItemFull extends MfgQuoteLineItem {
  materials: MfgCostMaterial[]
  hardware: MfgCostHardware[]
}

// ─── Cost Build — Materials ───────────────────────────────────────────────────

export interface MfgCostMaterial {
  id: string
  line_item_id: string
  price_book_item_id: string | null
  item_name: string
  unit: string
  quantity: number
  unit_cost: number | null          // null when supplier_quoted = true
  supplier_quoted: boolean
  sort_order: number
  created_at: string
}

// ─── Cost Build — Hardware ────────────────────────────────────────────────────

export interface MfgCostHardware {
  id: string
  line_item_id: string
  price_book_item_id: string | null
  item_name: string
  unit: string
  quantity: number
  unit_cost: number | null
  supplier_quoted: boolean
  apply_markup: boolean
  markup_percentage: number | null  // null = use line item default
  sort_order: number
  created_at: string
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface MfgLineItemTemplate {
  id: string
  portal_account_id: string
  template_name: string
  description: string | null
  callout_note: string | null
  default_markup_percentage: number
  created_at: string
  updated_at: string
}

export interface MfgTemplateMaterial {
  id: string
  template_id: string
  price_book_item_id: string | null
  item_name: string
  unit: string
  quantity: number
  sort_order: number
}

export interface MfgTemplateHardware {
  id: string
  template_id: string
  price_book_item_id: string | null
  item_name: string
  unit: string
  quantity: number
  apply_markup: boolean
  sort_order: number
}

export interface MfgLineItemTemplateFull extends MfgLineItemTemplate {
  materials: MfgTemplateMaterial[]
  hardware: MfgTemplateHardware[]
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface MfgInvoice {
  id: string
  portal_account_id: string
  quote_id: string | null
  job_id: string
  invoice_number: string
  invoice_type: MfgInvoiceType
  status: MfgInvoiceStatus
  apply_vat: boolean
  vat_rate: number
  subtotal: number
  vat_amount: number
  total: number
  amount_paid: number
  due_date: string | null
  sent_to_email: string | null
  sent_at: string | null
  sent_by_name: string | null
  sent_by_email: string | null
  sent_by_phone: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface MfgInvoiceWithJob extends MfgInvoice {
  job: MfgJobWithClient
  quote: MfgQuote | null
}

// ─── Invoice Payments ─────────────────────────────────────────────────────────

export interface MfgInvoicePayment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: MfgPaymentMethod
  reference: string | null
  notes: string | null
  created_at: string
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface MfgActivityLogEntry {
  id: string
  portal_account_id: string
  entity_type: MfgActivityEntityType
  entity_id: string
  action: string
  actor_name: string | null
  actor_email: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface MfgDashboardKPIs {
  invoiced_this_month: number
  invoiced_last_month: number
  received_this_month: number
  received_last_month: number
  pipeline_value: number
  pipeline_count: number
  avg_margin_this_month: number
  avg_margin_last_month: number
}

export interface MfgDashboardAttentionItem {
  type: 'overdue_invoice' | 'expiring_quote' | 'no_response_quote' | 'pending_supplier_quote'
  entity_type: 'quote' | 'invoice'
  entity_id: string
  entity_number: string
  client_name: string
  job_name: string
  value: number
  days: number    // days overdue / days until expiry / days since sent
}

export interface MfgMonthlyRevenue {
  month: string   // 'YYYY-MM'
  invoiced: number
  received: number
}

// ─── PDF Props ────────────────────────────────────────────────────────────────

export interface MfgPDFProps {
  quote?: MfgQuoteFull
  invoice?: MfgInvoiceWithJob
  line_items: MfgQuoteLineItem[]  // for invoice, sourced from the linked quote
  settings: MfgSettings
  document_type: 'quote' | 'invoice' | 'deposit_invoice' | 'final_invoice'
}

// ─── Form State Helpers ───────────────────────────────────────────────────────

// Used in the cost builder UI before saving to DB
export interface MfgCostMaterialDraft extends Omit<MfgCostMaterial, 'id' | 'line_item_id' | 'created_at'> {
  id?: string
}

export interface MfgCostHardwareDraft extends Omit<MfgCostHardware, 'id' | 'line_item_id' | 'created_at'> {
  id?: string
  markup_percentage: number | null
}

export interface MfgQuoteLineItemDraft extends Omit<MfgQuoteLineItem, 'id' | 'quote_id' | 'created_at' | 'updated_at'> {
  id?: string
  materials: MfgCostMaterialDraft[]
  hardware: MfgCostHardwareDraft[]
  cost_builder_open: boolean   // UI state — not persisted
}
