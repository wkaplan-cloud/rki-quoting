/**
 * Optional lines and alternative sections — client-safe helpers shared by the
 * editor, the client approval page, the PDFs and the emails, so they all
 * agree on the total.
 *
 * Alternatives (good / better / best): sections sharing an option_group, of
 * which exactly one counts — the chosen one, or the first if none is marked.
 * On acceptance the others are deleted, like untaken optional lines.
 *
 * An optional line is priced on the quote but sits outside its total until
 * the client takes it (optional_selected). Once the quote is accepted the
 * untaken ones are deleted and the taken ones become ordinary lines, so
 * nothing downstream of acceptance ever sees an optional.
 */

export interface OptionalFlags {
  is_optional?: boolean | null
  optional_selected?: boolean | null
}

/** Whether a line counts towards the quote total. */
export function countsInQuoteTotal(item: OptionalFlags): boolean {
  return !item.is_optional || !!item.optional_selected
}

/** An optional extra the client has not taken (yet). */
export function isOpenOptional(item: OptionalFlags): boolean {
  return !!item.is_optional && !item.optional_selected
}

export interface OptionSection {
  id: string
  sort_order: number
  option_group?: string | null
  option_chosen?: boolean | null
}

/** Sections that are alternatives nobody chose — everything in them sits outside the total. */
export function excludedSectionIds(sections: OptionSection[]): Set<string> {
  const groups = new Map<string, OptionSection[]>()
  for (const s of sections) {
    if (!s.option_group) continue
    groups.set(s.option_group, [...(groups.get(s.option_group) ?? []), s])
  }
  const excluded = new Set<string>()
  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => a.sort_order - b.sort_order)
    const chosen = ordered.find(s => s.option_chosen) ?? ordered[0]
    for (const s of ordered) if (s.id !== chosen.id) excluded.add(s.id)
  }
  return excluded
}

/** Whether a line counts toward the quote total, allowing for both optional lines and alternatives. */
export function lineCounts(item: OptionalFlags & { section_id: string | null }, excluded: Set<string>): boolean {
  return countsInQuoteTotal(item) && !(item.section_id && excluded.has(item.section_id))
}
