// One price parser, shared by the supplier's pricing form and the endpoint it
// posts to, so what a supplier sees interpreted on screen is exactly what gets
// stored. Written after a real submission lost all 14 prices silently: the old
// field stripped every character that wasn't a digit or a dot, which turned the
// standard South African "12 500,00" into 1250000 and quietly dropped
// "12.500.00" as NaN. Nothing told the supplier, and nothing told us.

export interface ParsedPrice {
  /** The amount, or null when the supplier left the field empty. */
  value: number | null
  /** Set when the text can't be read as money — never silently discarded. */
  error: string | null
}

const MAX = 100_000_000

/**
 * Read a typed price the way a South African supplier writes one.
 *
 * Handles "R12 500,00", "12.500,00", "12,500.00", "12500", "2,5" and the bare
 * forms in between. Thousands separators are inferred from position rather
 * than assumed: a single separator followed by exactly three digits is a
 * thousands separator ("12.500" = twelve and a half thousand), anything else
 * is a decimal ("12.50" = twelve rand fifty).
 */
export function parsePriceInput(raw: unknown): ParsedPrice {
  if (raw === null || raw === undefined) return { value: null, error: null }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 && raw <= MAX
      ? { value: round2(raw), error: null }
      : { value: null, error: 'That amount is out of range.' }
  }
  if (typeof raw !== 'string') return { value: null, error: 'Enter an amount.' }

  // Currency marks and spacing are noise, not errors — a supplier typing
  // "R 12 500,00" means exactly what they look like they mean.
  let s = raw.trim().replace(/^(?:zar|r)\s*/i, '')
  s = s.replace(/[\s  ]/g, '')
  if (!s) return { value: null, error: null }

  if (!/^[\d.,]+$/.test(s)) return { value: null, error: 'Use numbers only — no words or symbols.' }
  if (!/\d/.test(s)) return { value: null, error: 'Enter an amount.' }

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let decimalAt = -1

  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal point, the other groups
    decimalAt = Math.max(lastDot, lastComma)
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ','
    const at = lastDot !== -1 ? lastDot : lastComma
    const occurrences = s.split(sep).length - 1
    const trailing = s.length - at - 1
    // Repeated separators only ever group thousands ("1.250.000"), and so does
    // a lone one with a full group of three behind it ("12.500")
    decimalAt = occurrences > 1 || trailing === 3 ? -1 : at
  }

  const digitsOnly = (t: string) => t.replace(/[.,]/g, '')
  const whole = decimalAt === -1 ? digitsOnly(s) : digitsOnly(s.slice(0, decimalAt))
  const frac = decimalAt === -1 ? '' : digitsOnly(s.slice(decimalAt + 1))

  if (frac.length > 2) return { value: null, error: 'Use at most two decimals.' }

  const n = Number(`${whole || '0'}.${frac || '0'}`)
  if (!Number.isFinite(n)) return { value: null, error: "That doesn't read as an amount." }
  if (n < 0) return { value: null, error: 'Enter a positive amount.' }
  if (n > MAX) return { value: null, error: 'That amount is too large.' }
  return { value: round2(n), error: null }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** "R 12 500,00" — built by hand so the server and the browser always agree. */
export function formatZar(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${n < 0 ? '-' : ''}R ${grouped},${dec}`
}
