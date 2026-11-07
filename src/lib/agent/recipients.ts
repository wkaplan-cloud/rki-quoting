/**
 * Turns a To or Cc header into display strings: "Thando Mlahlekelwa <t@x.co.za>",
 * or the bare address when there is no usable name. Names are whatever the
 * sender typed, so the address is always kept beside them. Addresses on
 * `excludeDomain` (the assistant's own) are dropped.
 */
export function parseAddressHeader(header: string | null | undefined, excludeDomain?: string | null): string[] {
  if (!header) return []
  const out: string[] = []
  for (const part of splitOutsideQuotes(header)) {
    const address = (part.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? part.match(/[^\s<>",;:]+@[^\s<>",;:]+/)?.[0])?.toLowerCase()
    if (!address) continue
    if (excludeDomain && address.endsWith(`@${excludeDomain.toLowerCase()}`)) continue
    const name = part.replace(/<[^<>]*>/, '').replace(/"/g, '').replace(/\s+/g, ' ').trim()
    // "=?UTF-8?…" is an undecoded header name: unreadable, so show the address alone.
    const usable = name && !name.includes('=?') && name.toLowerCase() !== address
    const entry = usable ? `${name} <${address}>` : address
    if (!out.includes(entry)) out.push(entry)
  }
  return out
}

function splitOutsideQuotes(header: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const ch of header) {
    if (ch === '"') quoted = !quoted
    if (ch === ',' && !quoted) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

/**
 * Swaps stored recipients for the studio's own names where the address is on
 * its team, because a sender's address book can call info@ anything. Done when
 * showing the page, so a renamed team member is right on old emails too.
 */
export function withTeamNames(recipients: string[], teamNames: Map<string, string>): string[] {
  return recipients.map(r => {
    const address = r.match(/<([^<>]+)>$/)?.[1] ?? r
    return teamNames.get(address) ?? r
  })
}
