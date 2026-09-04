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
  quote_send_bcc_admins: boolean
  job_card_extras_enabled: boolean
  // Sage Accounting
  sage_username: string | null
  sage_password: string | null
  sage_company_id: string | null
  sage_access_token: string | null
  sage_refresh_token: string | null
  sage_token_expires_at: string | null
  sage_item_id: number | null
  // COC defaults — registered person
  reg_person_name: string | null
  reg_person_id_no: string | null
  reg_person_reg_no: string | null
  reg_person_reg_date: string | null
  reg_person_type: string | null
  reg_person_address: string | null
  reg_person_tel: string | null
  reg_person_fax: string | null
  reg_person_cell: string | null
  reg_person_email: string | null
  // COC defaults — electrical contractor
  contractor_name: string | null
  contractor_id_no: string | null
  contractor_reg_no: string | null
  contractor_reg_date: string | null
  contractor_address: string | null
  contractor_tel: string | null
  contractor_fax: string | null
  contractor_cell: string | null
  contractor_email: string | null
  created_at: string
  updated_at: string
}

// ─── COC Test Report (Section 2–4, stored as JSONB) ──────────────────────────

export interface COCTestReport {
  // Section 2 — Installation
  installation_permanent: boolean
  supply_system: string      // 'TN-S' | 'TN-C-S' | 'TN-C' | 'TT' | 'IT'
  voltage: string            // '230V' | '400V' | '525V' | 'other'
  voltage_other: string
  phases: string             // 'one' | 'two' | 'three'
  phase_rotation: string     // 'clockwise' | 'anticlockwise'
  frequency: string          // '50Hz' | 'other' | 'dc'
  frequency_other: string
  main_switch_type: string   // 'switch_disconnector' | 'fuse_switch' | 'circuit_breaker' | 'elcb' | 'elsd'
  main_switch_poles: string
  main_switch_current_rating: string
  main_switch_sc_rating: string
  earth_leakage_current: string   // '30mA' | 'other'
  earth_leakage_current_other: string
  surge_protection: boolean
  lightning_protection: boolean
  alt_power_supply: boolean
  specialised_installation: boolean
  above_1kv: boolean
  // Section 3 — Circuit counts (New / Existing)
  lighting_circuits_new: string;    lighting_circuits_existing: string
  lighting_points_new: string;      lighting_points_existing: string
  socket_outlet_circuits_new: string; socket_outlet_circuits_existing: string
  socket_outlets_new: string;       socket_outlets_existing: string
  ac_circuits_new: string;          ac_circuits_existing: string
  transformer_lighting_new: string; transformer_lighting_existing: string
  transformer_bell_new: string;     transformer_bell_existing: string
  transformer_other_new: string;    transformer_other_existing: string
  heating_new: string;              heating_existing: string
  alt_power_new: string;            alt_power_existing: string
  fan_circuits_new: string;         fan_circuits_existing: string
  cooking_new: string;              cooking_existing: string
  geyser_new: string;               geyser_existing: string
  pool_pump_new: string;            pool_pump_existing: string
  borehole_pump_new: string;        borehole_pump_existing: string
  fixed_other_new: string;          fixed_other_existing: string
  earth_leakage_complete: boolean
  earth_leakage_partial: boolean
  // Section 4 — Inspection checkboxes (yes | no | na)
  inspect_conductors: string
  inspect_components: string
  inspect_disconnecting: string
  inspect_labelled: string
  // Section 4 — Test readings
  test_continuity_bonding: string      // 'compliant' | 'non_compliant' | 'na'
  test_earth_resistance: string        // 'compliant' | 'non_compliant' | 'na'
  test_ring_circuits: string
  test_earth_loop: string              // Ω
  test_neutral_loop: string            // Ω
  test_pscc_value: string              // kA
  test_pscc_method: string             // 'calculated' | 'measured'
  test_elevated_voltage: string        // V
  test_insulation: string              // MΩ
  test_voltage_no_load_a: string; test_voltage_no_load_b: string; test_voltage_no_load_c: string
  test_voltage_load_a: string;    test_voltage_load_b: string;    test_voltage_load_c: string
  test_earth_leakage_value: string     // mA
  test_earth_leakage_button: string    // 'correct' | 'incorrect' | 'na'
  test_polarity: string                // 'correct' | 'incorrect' | 'na'
  test_phase_rotation: string          // 'correct' | 'incorrect' | 'na'
  test_switching: string               // 'correct' | 'incorrect' | 'na'
  comments: string
  comments_not_covered: string
  // Section 5 — Responsibility (date + tel on the test report)
  section5_date: string
  section5_tel: string
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
  default_cost_rate: number | null
  default_labour_rate: number | null
  default_material_rate: number | null
  default_markup_percent: number | null
  category: string | null
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
  vat_rate: number | null
  retention_percentage: number
  payment_terms_days: number
  liquidated_damages_per_day: number | null
  defects_liability_period_days: number
  staff_id: string | null
  additional_staff_ids: string[] | null
  notes: string | null
  drawing_reference: string | null
  quoted_date: string | null
  approved_date: string | null
  expected_completion_date: string | null
  practical_completion_date: string | null
  archived_at: string | null
  invoiced: boolean | null
  is_quick_job: boolean | null
  source_job_card_id: string | null
  share_token: string | null
  share_token_created_at: string | null
  created_by_name: string | null
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
  return item.quoted_quantity * (item.quoted_unit_rate + (item.labour_rate ?? 0))
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
  share_token: string | null
  sent_to_email: string | null
  sent_at: string | null
  rejection_notes: string | null
  cost_value: number | null
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
  share_token: string | null
  share_token_created_at: string | null
  // Sage Accounting
  sage_invoice_id: string | null
  sage_invoice_status: string | null
  sage_pushed_at: string | null
  sage_customer_id: string | null
  sage_customer_name: string | null
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
  quote_id: string | null
  job_card_id: string | null
  portal_account_id: string | null
  // ── COC Certificate ──────────────────────────────────────────────────────────
  coc_number: string              // ECA certificate number — blank, electrician fills
  certificate_type: string | null // 'initial' | 'supplementary'
  supplement_no: string | null
  to_initial_cert_no: string | null
  initial_cert_date: string | null
  issue_date: string
  regulation_type: string | null  // 'a' | 'b' | 'c'
  // ── Location ─────────────────────────────────────────────────────────────────
  installation_address: string | null
  name_of_building: string | null
  suburb_township: string | null
  district_town_city: string | null
  gps_coordinates: string | null
  pole_number: string | null
  erf_lot_no: string | null
  db_supply: string | null        // "Test Report for DB/Supply" header field
  additional_pages: boolean | null
  // ── Owner / Occupier ─────────────────────────────────────────────────────────
  owner_name: string | null
  // ── Registered Person (per-COC snapshot, pre-filled from settings) ───────────
  tester_name: string             // registered person's full name
  tester_registration_number: string | null  // registration certificate no.
  reg_person_id_no: string | null
  reg_person_reg_date: string | null
  reg_person_type: string | null  // 'master' | 'installation' | 'single_phase'
  reg_person_address: string | null
  reg_person_tel: string | null
  reg_person_fax: string | null
  reg_person_cell: string | null
  reg_person_email: string | null
  // ── Electrical Contractor (per-COC snapshot) ──────────────────────────────────
  contractor_name: string | null
  contractor_id_no: string | null
  contractor_reg_no: string | null
  contractor_reg_date: string | null
  contractor_address: string | null
  contractor_tel: string | null
  contractor_fax: string | null
  contractor_cell: string | null
  contractor_email: string | null
  // ── Recipient ────────────────────────────────────────────────────────────────
  recipient_name: string | null
  recipient_date: string | null
  // ── Section 2–4 data (JSONB) ─────────────────────────────────────────────────
  test_report: COCTestReport | null
  // ── Legacy fields kept for backward compat ───────────────────────────────────
  installation_description: string
  installation_type: string | null
  work_type: string | null
  supply_voltage: string | null
  supply_phases: string | null
  supply_earthing: string | null
  main_breaker_amps: string | null
  supply_authority: string | null
  earth_continuity: string | null
  insulation_resistance: string | null
  polarity: string | null
  earth_leakage: string | null
  overcurrent_protection: string | null
  phase_rotation: string | null
  linked_doc_number: string | null
  notes: string | null
  // ── Report — staff discoveries (line items) ──────────────────────────────────
  report_items?: COCReportItem[] | null
  // ── Photos ────────────────────────────────────────────────────────────────────
  photos?: COCPhoto[] | null
  // ── Email / sharing ──────────────────────────────────────────────────────────
  sent_to_name: string | null
  sent_to_email: string | null
  sent_at: string | null
  share_token: string | null
  created_at: string
}

export interface COCPhoto {
  url: string
  description: string | null
}

export interface COCReportItem {
  id: string
  description: string
}

// ─── Org Members (additional admins) ─────────────────────────────────────────

export interface PortalOrgMember {
  id: string
  portal_account_id: string
  auth_user_id: string | null
  email: string
  name: string | null
  role: string
  invited_by: string | null
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  created_at: string
}

// ─── Time Punches ─────────────────────────────────────────────────────────────

export type TimePunchType = 'clock_in' | 'clock_out'

export interface ElecTimePunch {
  id: string
  portal_account_id: string
  staff_id: string
  punch_type: TimePunchType
  punched_at: string
  latitude: number | null
  longitude: number | null
  address: string | null
  job_id: string | null
  notes: string | null
  created_at: string
  // Joined
  staff?: ElecStaff
  job?: { id: string; job_number: string; title: string } | null
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ElecNotification {
  id: string
  portal_account_id: string
  type: string
  title: string
  body: string | null
  read_at: string | null
  metadata: Record<string, unknown>
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
  auth_user_id: string | null
  username: string | null
  pin_hash: string | null
  invite_token: string | null
  invite_sent_at: string | null
  invite_accepted_at: string | null
  created_at: string
}

// ─── Jobs (scheduling) ───────────────────────────────────────────────────────

export type ElecJobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface ElecJob {
  id: string
  portal_account_id: string
  quote_id: string | null
  job_card_id: string | null
  staff_id: string | null
  title: string
  address: string | null
  notes: string | null
  scheduled_date: string   // 'YYYY-MM-DD'
  start_time: string       // 'HH:MM:SS'
  end_time: string         // 'HH:MM:SS'
  status: ElecJobStatus
  share_token: string | null
  share_token_created_at: string | null
  created_at: string
  // Joined
  staff?: ElecStaff | null
  quote?: { id: string; quote_number: string; project_name: string } | null
  job_card?: { id: string; job_number: string; title: string } | null
  photo_count?: number
}

export interface ElecJobPhoto {
  id: string
  job_id: string
  portal_account_id: string
  storage_path: string
  public_url: string
  file_name: string | null
  uploaded_by_name: string | null
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

// ─── Job Cards ────────────────────────────────────────────────────────────────

export type ElecJobCardType   = 'maintenance' | 'repair' | 'once_off' | 'callout' | 'coc'
export type ElecJobCardStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface ElecJobCard {
  id: string
  portal_account_id: string
  quote_id: string | null
  staff_id: string | null
  additional_staff_ids: string[] | null
  client_id: string | null
  job_number: string
  job_type: ElecJobCardType
  status: ElecJobCardStatus
  title: string
  location: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  work_description: string | null
  work_found: string | null
  work_done: string | null
  resolution: string | null
  notes: string | null
  client_name: string | null
  client_email: string | null
  client_signature_url: string | null
  sent_to_name: string | null
  sent_to_email: string | null
  sent_at: string | null
  amended_at: string | null
  share_token: string | null
  invoiced: boolean | null
  sage_invoice_id: string | null
  sage_invoice_status: string | null
  sage_pushed_at: string | null
  sage_customer_id: string | null
  sage_customer_name: string | null
  created_by_name: string | null
  // Charges
  callout_fee: number | null
  labour_hours: number | null
  labour_rate: number | null
  created_at: string
  // Joined
  staff?: ElecStaff | null
  client?: ElecClient | null
  quote?: { id: string; quote_number: string; project_name: string } | null
  materials?: ElecJobCardMaterial[]
  photos?: ElecJobCardPhoto[]
  extras?: ElecJobCardExtra[]
}

export interface ElecJobCardMaterial {
  id: string
  job_card_id: string
  description: string
  qty: number
  unit_price: number | null
  cost_price: number | null
  created_at: string
}

/** Extra work the client asked for on site — priced by the office as its own quote. */
export interface ElecJobCardExtra {
  id: string
  job_card_id: string
  portal_account_id: string
  description: string
  unit: string | null
  qty: number
  notes: string | null
  created_by_staff_id: string | null
  created_by_name: string | null
  quote_id: string | null
  submitted_at: string | null
  created_at: string
  // Joined
  quote?: { id: string; quote_number: string; status: ElecQuoteStatus } | null
}

export interface ElecJobCardPhoto {
  id: string
  job_card_id: string
  url: string
  caption: string | null
  uploaded_at: string
}

// ─── Material Requests ────────────────────────────────────────────────────────

export type ElecMaterialRequestStatus = 'pending' | 'ordered' | 'received' | 'cancelled'

export interface ElecMaterialRequest {
  id: string
  portal_account_id: string
  source_type: 'job_card' | 'project'
  job_card_id: string | null
  quote_id: string | null
  line_item_id: string | null
  is_variation: boolean
  description: string
  qty: number
  unit: string | null
  notes: string | null
  requested_by_staff_id: string | null
  requested_by_name: string | null
  status: ElecMaterialRequestStatus
  supplier: string | null
  ordered_at: string | null
  received_at: string | null
  created_at: string
  // Joined
  job_card?: { id: string; job_number: string; title: string } | null
  quote?: { id: string; quote_number: string; project_name: string } | null
  line_item?: { id: string; description: string } | null
}
