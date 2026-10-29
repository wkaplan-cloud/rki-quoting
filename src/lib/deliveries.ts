// Delivery timeline — the per-org feature behind settings.delivery_timeline_enabled.
//
// A line item's expected delivery is its own `delivery_date` when one is set,
// otherwise the date set for its supplier on that project. Dates are plain
// "YYYY-MM-DD" strings throughout, so they compare correctly as strings and
// never shift with the server's timezone.

/** supplier_name → that supplier's delivery date on one project. */
export type SupplierDates = Record<string, string | null>

export interface DeliveryLine {
  supplier_name: string | null
  delivery_date?: string | null
  received: boolean
}

/** Lines that represent something being delivered: real items with a supplier. */
export function isDeliveryLine(line: { row_type: string; supplier_name: string | null }): boolean {
  return line.row_type === 'item' && !!line.supplier_name?.trim()
}

export function supplierKey(name: string | null): string {
  return name?.trim() ?? ''
}

export function expectedDate(line: DeliveryLine, supplierDates: SupplierDates): string | null {
  return line.delivery_date ?? supplierDates[supplierKey(line.supplier_name)] ?? null
}

/**
 * received — ticked as received in the line items table
 * late     — due after the project's installation deadline
 * overdue  — the date has passed and it isn't ticked as received
 * due      — dated, on time
 * undated  — no date for the item or its supplier yet
 */
export type DeliveryState = 'received' | 'late' | 'overdue' | 'due' | 'undated'

export function deliveryState(
  date: string | null,
  received: boolean,
  installDeadline: string | null,
  today: string,
): DeliveryState {
  if (received) return 'received'
  if (!date) return 'undated'
  if (installDeadline && date > installDeadline) return 'late'
  if (date < today) return 'overdue'
  return 'due'
}

export const DELIVERY_STATE_LABEL: Record<DeliveryState, string> = {
  received: 'Received',
  late:     'After deadline',
  overdue:  'Overdue',
  due:      'On track',
  undated:  'No date',
}

/** "2026-11-04" → "4 Nov 2026" without going through a Date (no timezone drift). */
export function formatDeliveryDate(date: string | null): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  return `${d} ${month} ${y}`
}
