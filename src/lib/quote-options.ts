/**
 * Optional quote lines — client-safe helpers shared by the editor, the
 * client approval page and the PDF, so all three agree on the total.
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
