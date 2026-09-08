/**
 * One place where a job card's money is worked out.
 *
 * The PDF, the email body and the client's sign link each used to do this
 * arithmetic themselves, and the email's copy counted materials only — so an
 * emailed card with a call-out fee or labour on it quoted a total lower than
 * the PDF attached to that same email. Everything that shows a client a figure
 * goes through here.
 */

export interface JobCardCharges {
  materials?: { qty: number; unit_price: number | null }[] | null
  callout_fee?: number | null
  labour_hours?: number | null
  labour_rate?: number | null
}

export interface JobCardTotals {
  materialsSubtotal: number
  calloutFee: number
  labourCharge: number
  /** Call-out + labour + materials, excluding VAT. */
  subtotal: number
  vatRate: number
  vat: number
  /** Subtotal plus VAT — the number a client is asked to pay. */
  total: number
}

export function jobCardTotals(card: JobCardCharges, vatRate = 15): JobCardTotals {
  const materialsSubtotal = (card.materials ?? []).reduce(
    (sum, m) => sum + m.qty * (m.unit_price ?? 0), 0)
  const calloutFee = card.callout_fee ?? 0
  const labourCharge = (card.labour_hours ?? 0) * (card.labour_rate ?? 0)
  const subtotal = calloutFee + labourCharge + materialsSubtotal
  const vat = subtotal * vatRate / 100
  return { materialsSubtotal, calloutFee, labourCharge, subtotal, vatRate, vat, total: subtotal + vat }
}
