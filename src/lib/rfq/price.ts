// One number parser, shared by the supplier's pricing form and the endpoint it
// posts to, so what a supplier sees interpreted on screen is exactly what gets
// stored. Prices and fabric quantities read through the same core: both are
// typed by the same hand, in the same South African notation, on the same form. Written after a real submission lost all 14 prices silently: the old
// field stripped every character that wasn't a digit or a dot, which turned the
// standard South African "12 500,00" into 1250000 and quietly dropped
// "12.500.00" as NaN. Nothing told the supplier, and nothing told us.

export interface ParsedPrice {
  /** The number, or null when the supplier left the field empty. */
  value: number | null
  /** Set when the text can't be read — never silently discarded. */
  error: string | null
}

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
  return parseDecimal(raw, MONEY)
}

/**
 * Read a typed quantity — metres of fabric or leather off a supplier's own
 * measure. Same South African number handling as a price (a supplier writes
 * "2,5" as readily as "2.5"), with its own wording and ceiling, and a trailing
 * unit forgiven: "14 m" and "14m" are a quantity, not a syntax error.
 */
export function parseQuantityInput(raw: unknown): ParsedPrice {
  return parseDecimal(raw, QUANTITY)
}

/**
 * What a field is made of, so one number parser can serve both without either
 * one inheriting the other's error messages.
 */
interface NumberKind {
  max: number
  /**
   * Whether a lone separator with three digits behind it groups thousands.
   * True for money ("12.500" is twelve and a half thousand rand), false for
   * metres, where no item takes a four-figure yardage and "12.500" can only
   * sensibly be twelve and a half metres.
   */
  grouped: boolean
  /** Stripped off the front before parsing — a currency mark on a price. */
  leading: RegExp | null
  /** Stripped off the end — a unit on a quantity. */
  trailing: RegExp | null
  outOfRange: string
  empty: string
  notANumber: string
  unreadable: string
  negative: string
  tooLarge: string
  tooPrecise: string
}

const MONEY: NumberKind = {
  max: 100_000_000,
  grouped: true,
  leading: /^(?:zar|r)\s*/i,
  trailing: null,
  outOfRange: 'That amount is out of range.',
  empty: 'Enter an amount.',
  notANumber: 'Use numbers only — no words or symbols.',
  unreadable: "That doesn't read as an amount.",
  negative: 'Enter a positive amount.',
  tooLarge: 'That amount is too large.',
  tooPrecise: 'Use at most two decimals.',
}

const QUANTITY: NumberKind = {
  // A single item never takes ten thousand metres — a figure that big is a
  // price typed into the wrong box, which is exactly what this should catch.
  max: 10_000,
  grouped: false,
  leading: null,
  trailing: /(?:m2|m²|sqm|mtrs?|met(?:re|er)s?|m)$/i,
  outOfRange: 'That quantity is out of range.',
  empty: 'Enter a quantity.',
  notANumber: 'Use numbers only — no words or symbols.',
  unreadable: "That doesn't read as a quantity.",
  negative: 'Enter a positive quantity.',
  tooLarge: 'That looks too large for one item — check it reads in metres.',
  tooPrecise: 'Use at most two decimals.',
}

function parseDecimal(raw: unknown, kind: NumberKind): ParsedPrice {
  if (raw === null || raw === undefined) return { value: null, error: null }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 && raw <= kind.max
      ? { value: round2(raw), error: null }
      : { value: null, error: kind.outOfRange }
  }
  if (typeof raw !== 'string') return { value: null, error: kind.empty }

  // Currency marks, units and spacing are noise, not errors — a supplier
  // typing "R 12 500,00" or "2,5 m" means exactly what they look like they mean.
  let s = raw.trim()
  if (kind.leading) s = s.replace(kind.leading, '')
  s = s.replace(/[\s  ]/g, '')
  if (kind.trailing) s = s.replace(kind.trailing, '')
  if (!s) return { value: null, error: null }

  if (!/^[\d.,]+$/.test(s)) return { value: null, error: kind.notANumber }
  if (!/\d/.test(s)) return { value: null, error: kind.empty }

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
    // a lone one with a full group of three behind it ("12.500") — in a field
    // where a number that big is plausible at all.
    // Where separators never group, more than one of them has no reading at
    // all — "1.250.000" metres is a slip, and answering it with a confident
    // 1250 is exactly the silent wrong number this parser exists to refuse.
    if (!kind.grouped && occurrences > 1) return { value: null, error: kind.unreadable }
    decimalAt = kind.grouped && (occurrences > 1 || trailing === 3) ? -1 : at
  }

  const digitsOnly = (t: string) => t.replace(/[.,]/g, '')
  const whole = decimalAt === -1 ? digitsOnly(s) : digitsOnly(s.slice(0, decimalAt))
  const frac = decimalAt === -1 ? '' : digitsOnly(s.slice(decimalAt + 1))

  // Trailing zeros carry no precision: "2,500" metres is 2.5, not a number
  // written to three decimals, and refusing it would be pedantry at the
  // supplier's expense.
  if (frac.replace(/0+$/, '').length > 2) return { value: null, error: kind.tooPrecise }

  const n = Number(`${whole || '0'}.${frac || '0'}`)
  if (!Number.isFinite(n)) return { value: null, error: kind.unreadable }
  if (n < 0) return { value: null, error: kind.negative }
  if (n > kind.max) return { value: null, error: kind.tooLarge }
  return { value: round2(n), error: null }
}

/** "2,5 m" — the same hand-built formatting as formatZar, for a quantity. */
export function formatMetres(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '')
  return `${s.replace('.', ',')} m`
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** "R 12 500,00" — built by hand so the server and the browser always agree. */
export function formatZar(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${n < 0 ? '-' : ''}R ${grouped},${dec}`
}
