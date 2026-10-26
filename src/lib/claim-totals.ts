/**
 * One place where a progress claim's money is worked out.
 *
 * The claim PDF and the Sage push each used to do this themselves and
 * disagreed: Sage treated the (ex-VAT) claim as VAT-inclusive and dropped
 * retention, and the PDF charged VAT before retention came off — then again
 * on the retention release. Everything that bills a claim goes through here.
 *
 * Amounts on a claim are all excl. VAT. What is billed is the QS-certified
 * figure once there is one (any cut is carried to the next claim), less
 * retention; VAT is charged on what is billed now, and on the retention only
 * when the retention claim releases it.
 */

export interface ClaimCharges {
  claim_type: string
  total_claimed: number | null
  total_certified?: number | null
  total_invoiced?: number | null
}

export interface ClaimTotals {
  claimed: number
  /** Claimed minus certified — rolls forward onto the next claim. */
  notCertified: number
  /** What this claim bills before retention, excl. VAT. */
  billed: number
  retentionPct: number
  retention: number
  /** Billed less retention, excl. VAT — the amount on the tax invoice. */
  net: number
  vatRate: number
  vat: number
  /** Net plus VAT — the number the client is asked to pay. */
  total: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export interface ValuedLine {
  quoted_quantity: number | null
  quoted_unit_rate: number | null
  labour_rate?: number | null
  as_built_quantity?: number | null
  as_built_unit_rate?: number | null
}

/** A quote line's full contract value — materials plus labour, excl. VAT. */
export function lineContractValue(i: ValuedLine): number {
  const qty = i.quoted_quantity ?? 0
  return qty * (i.quoted_unit_rate ?? 0) + qty * (i.labour_rate ?? 0)
}

/** A line's as-built value — as-built qty and rate where set, labour at the as-built qty. */
export function lineAsBuiltValue(i: ValuedLine): number {
  const qty = i.as_built_quantity ?? i.quoted_quantity ?? 0
  return qty * (i.as_built_unit_rate ?? i.quoted_unit_rate ?? 0) + qty * (i.labour_rate ?? 0)
}

/**
 * The money for certifying a claim line at `pct`, scaled from what was
 * claimed on it, so certifying at the claimed % gives back exactly the
 * claimed amount whatever the line's rates are now.
 */
export function certifiedAmount(line: { percentage_claimed: number; amount_claimed: number }, pct: number): number {
  return line.percentage_claimed > 0 ? round2(line.amount_claimed * pct / line.percentage_claimed) : 0
}

export function claimTotals(claim: ClaimCharges, retentionPercentage: number | null | undefined, vatRate: number): ClaimTotals {
  const claimed = round2(claim.total_claimed ?? 0)
  const billed = round2(claim.total_invoiced ?? claim.total_certified ?? claim.total_claimed ?? 0)
  const retentionPct = claim.claim_type !== 'retention' && (retentionPercentage ?? 0) > 0 ? retentionPercentage! : 0
  const retention = round2(billed * retentionPct / 100)
  const net = round2(billed - retention)
  const vat = round2(net * vatRate / 100)
  return {
    claimed,
    notCertified: round2(Math.max(0, claimed - billed)),
    billed, retentionPct, retention, net, vatRate, vat,
    total: round2(net + vat),
  }
}
