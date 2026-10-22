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
