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

export interface ProjectTotals {
  subtotal: number
  design_fee: number
  vat_base: number
  vat_amount: number
  grand_total: number
  deposit_70: number
  balance_due: number
}
