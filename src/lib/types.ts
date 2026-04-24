export interface Client {
  id: string
  client_name: string
  company: string | null
  email: string | null
  vat_number: string | null
  contact_number: string | null
  address: string | null
  created_at: string
}

export interface Supplier {
  id: string
  supplier_name: string
  category: string | null
  contact_person: string | null
  contact_number: string | null
  rep_name: string | null
  rep_number: string | null
  email: string | null
  email_cc: string | null
  delivery_address: string | null
  delivery_contact_name: string | null
  delivery_contact_number: string | null
  markup_percentage: number
  is_platform: boolean
  price_list_id: string | null
  created_at: string
}

export interface Item {
  id: string
  item_name: string
  created_at: string
}

export type ProjectStatus = 'Draft' | 'Quote' | 'Invoice' | 'Paid' | 'Completed' | 'Cancelled'

export interface Project {
  id: string
  project_number: string
  project_name: string
  client_id: string | null
  date: string
  status: ProjectStatus
  design_fee: number
  vat_rate: number | null
  deposit_percentage: number | null
  notes: string | null
  created_at: string
  user_id: string | null
  sage_invoice_id: string | null
  sage_invoice_status: string | null
  sage_pushed_at: string | null
  quoted_date: string | null
  archived_at: string | null
  // joined
  client?: Client | null
}

export interface LineItem {
  id: string
  project_id: string
  item_name: string
  description: string | null
  quantity: number
  supplier_id: string | null
  supplier_name: string | null
  delivery_address: string | null
  cost_price: number
  markup_percentage: number
  sort_order: number
  row_type: 'item' | 'section'
  indent_level: number
  received: boolean
  fabric_image_url: string | null
  unit: string | null
  lead_time_weeks: number | null
  lead_time_days: number | null
  dimensions: string | null
  colour_finish: string | null
  twinbru_product_id: number | null
  twinbru_cost_price: number | null
  fabric_width_cm: number | null
  parent_item_id: string | null
  created_at: string
}

export interface LineItemComputed extends LineItem {
  sale_price: number
  profit: number
  total_cost: number
  total_price: number
}

export interface ProjectStages {
  id: string
  project_id: string
  quote_sent: boolean
  quote_sent_at: string | null
  deposit_received: boolean
  deposit_received_at: string | null
  pos_sent: boolean
  pos_sent_at: string | null
  fabrics_received: boolean
  fabrics_received_at: string | null
  fabrics_sent: boolean
  fabrics_sent_at: string | null
  final_invoice_sent: boolean
  final_invoice_sent_at: string | null
  final_invoice_paid: boolean
  final_invoice_paid_at: string | null
  delivered_installed: boolean
  delivered_installed_at: string | null
}

export const STAGE_CONFIG = [
  { key: 'quote_sent',         label: 'Quote Sent',         dateKey: 'quote_sent_at' },
  { key: 'deposit_received',   label: 'Deposit Received',   dateKey: 'deposit_received_at' },
  { key: 'fabrics_received',   label: 'Fabrics Received',   dateKey: 'fabrics_received_at' },
  { key: 'final_invoice_sent', label: 'Balance Due Sent',   dateKey: 'final_invoice_sent_at' },
  { key: 'final_invoice_paid', label: 'Paid in Full',       dateKey: 'final_invoice_paid_at' },
  { key: 'delivered_installed',label: 'Delivered & Installed', dateKey: 'delivered_installed_at' },
] as const

export type StageKey = typeof STAGE_CONFIG[number]['key']

export function statusFromStages(stages: ProjectStages | null | undefined): ProjectStatus {
  if (!stages) return 'Draft'
  if (stages.delivered_installed) return 'Completed'
  if (stages.final_invoice_paid) return 'Paid'
  if (stages.final_invoice_sent) return 'Invoice'
  if (stages.quote_sent) return 'Quote'
  return 'Draft'
}

export interface ProjectTotals {
  subtotal: number
  design_fee: number
  vat_base: number
  vat_amount: number
  grand_total: number
  deposit: number
  balance_due: number
}

// ─── Sourcing Requests ────────────────────────────────────────────────────────

export type SourcingRequestStatus =
  | 'draft'
  | 'sent'
  | 'responded'
  | 'accepted'
  | 'pushed'
  | 'cancelled'

export type SourcingRecipientStatus =
  | 'pending'
  | 'viewed'
  | 'responded'
  | 'accepted'
  | 'rejected'
  | 'declined'

export interface SourcingRequest {
  id: string
  user_id: string
  project_id: string | null
  title: string
  work_type: string | null
  specifications: string | null
  quantity: number
  unit: string | null
  item_quantity: number | null
  dimensions: string | null
  colour_finish: string | null
  status: SourcingRequestStatus
  sent_at: string | null
  accepted_at: string | null
  accepted_response_id: string | null
  pushed_at: string | null
  created_at: string
}

export interface SupplierEdits {
  title?: string
  fabric_quantity?: number
  fabric_unit?: string
  item_quantity?: number
  dimensions?: string
  colour_finish?: string
  specifications?: string
  [key: string]: unknown
}

export interface SourcingRequestImage {
  id: string
  sourcing_request_id: string
  url: string
  caption: string | null
  sort_order: number
  created_at: string
}

export interface SourcingRequestRecipient {
  id: string
  sourcing_request_id: string
  supplier_id: string | null
  supplier_name: string
  email: string
  token: string
  status: SourcingRecipientStatus
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  created_at: string
}

export interface SourcingRequestResponse {
  id: string
  recipient_id: string
  unit_price: number
  lead_time_weeks: number | null
  notes: string | null
  valid_until: string | null
  submitted_at: string
  supplier_edits: SupplierEdits | null
  changed_fields: string[] | null
  attachment_url: string | null
}

export interface SourcingRequestWithRelations extends SourcingRequest {
  images: SourcingRequestImage[]
  recipients: (SourcingRequestRecipient & {
    response: SourcingRequestResponse | null
    supplier: Pick<Supplier, 'id' | 'supplier_name' | 'markup_percentage'> | null
  })[]
}

export interface SourcingMessage {
  id: string
  recipient_id: string
  sender_type: 'designer' | 'supplier'
  body: string
  created_at: string
}

// ─── Supplier Portal ──────────────────────────────────────────────────────────

export interface SupplierPortalAccount {
  id: string
  auth_user_id: string
  email: string
  company_name: string | null
  created_at: string
}

export interface SupplierPriceListItem {
  id: string
  portal_account_id: string
  item_name: string
  description: string | null
  sku: string | null
  unit: string | null
  price: number | null
  lead_time_weeks: number | null
  image_url: string | null
  sort_order: number
  created_at: string
}
