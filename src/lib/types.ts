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

export type ProjectStatus = 'Draft' | 'Quote' | 'Invoice' | 'Completed' | 'Cancelled'

export interface Project {
  id: string
  project_number: string
  project_name: string
  client_id: string | null
  date: string
  status: ProjectStatus
  design_fee: number
  notes: string | null
  created_at: string
  user_id: string | null
  sage_invoice_id: string | null
  sage_invoice_status: string | null
  sage_pushed_at: string | null
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
  dimensions: string | null
  colour_finish: string | null
  twinbru_product_id: number | null
  twinbru_cost_price: number | null
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
