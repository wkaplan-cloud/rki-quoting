/**
 * The acceptance block printed at the foot of a quote — heading, wording and
 * the signature rules. Studios edit all three in Admin → Quote Defaults, or
 * switch the block off entirely.
 *
 * Kept out of lib/pdf so the admin form can import the defaults without
 * pulling in the server-only PDF renderer.
 */

export const DEFAULT_ACCEPTANCE_HEADING = 'ACCEPTANCE'
export const DEFAULT_ACCEPTANCE_TEXT =
  'Acceptance of this quotation may be confirmed by signing below or by payment of the required deposit. Either constitutes agreement to the above quotation and its terms and conditions.'
export const DEFAULT_ACCEPTANCE_LABELS = 'Full Name, Signature, Date'

/** More than four rules across an A4 page leaves nothing to sign on. */
const MAX_SIGNATURE_LABELS = 4

export interface AcceptanceSettings {
  acceptance_enabled?: boolean | null
  acceptance_heading?: string | null
  acceptance_text?: string | null
  acceptance_signature_labels?: string | null
}

export interface AcceptanceBlock {
  heading: string
  body: string
  labels: string[]
}

export function parseSignatureLabels(raw: string): string[] {
  return raw.split(',').map(l => l.trim()).filter(Boolean).slice(0, MAX_SIGNATURE_LABELS)
}

/**
 * What the quote should print. A null column means the studio never touched it,
 * so the default applies; an empty one means they deliberately cleared that part
 * and it is left out. Returns null when the whole block is off or empty.
 */
export function resolveAcceptance(settings: AcceptanceSettings | null | undefined): AcceptanceBlock | null {
  if (settings?.acceptance_enabled === false) return null

  const heading = (settings?.acceptance_heading ?? DEFAULT_ACCEPTANCE_HEADING).trim()
  const body = (settings?.acceptance_text ?? DEFAULT_ACCEPTANCE_TEXT).trim()
  const labels = parseSignatureLabels(settings?.acceptance_signature_labels ?? DEFAULT_ACCEPTANCE_LABELS)

  if (!heading && !body && labels.length === 0) return null
  return { heading, body, labels }
}
