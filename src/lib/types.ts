export interface Client {
  id: string
  client_name: string
  company: string | null
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
  delivery_address: string | null
  markup_percentage: number
  created_at: string
}

export interface Item {
  id: string
  item_name: string
  created_at: string
}

export type ProjectStatus = 'Quote' | 'Invoice' | 'Completed' | 'Cancelled'

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
  delivery: number
  cost_price: number
  markup_percentage: number
  sort_order: number
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
  items_received: boolean
  items_received_at: string | null
  fabrics_sent: boolean
  fabrics_sent_at: string | null
  final_invoice_sent: boolean
  final_invoice_sent_at: string | null
  delivered_installed: boolean
  delivered_installed_at: string | null
}

export const STAGE_CONFIG = [
  { key: 'quote_sent',         label: 'Quote Sent',         dateKey: 'quote_sent_at' },
  { key: 'deposit_received',   label: 'Deposit Received',   dateKey: 'deposit_received_at' },
  { key: 'pos_sent',           label: 'POs Sent',           dateKey: 'pos_sent_at' },
  { key: 'items_received',     label: 'Items Received',     dateKey: 'items_received_at' },
  { key: 'fabrics_sent',       label: 'Fabrics Sent',       dateKey: 'fabrics_sent_at' },
  { key: 'final_invoice_sent', label: 'Final Invoice Sent', dateKey: 'final_invoice_sent_at' },
  { key: 'delivered_installed',label: 'Delivered & Installed', dateKey: 'delivered_installed_at' },
] as const

export type StageKey = typeof STAGE_CONFIG[number]['key']

export interface ProjectTotals {
  subtotal: number
  design_fee: number
  vat_base: number
  vat_amount: number
  grand_total: number
  deposit_70: number
  balance_due: number
}
