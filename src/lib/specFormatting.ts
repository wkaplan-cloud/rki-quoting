import { CATEGORY_FIELDS, type CategoryKey } from './sourcing-categories'

// Per category: which field(s) compose the "overall size" (→ line_items.dimensions)
// and which single field is the colour/finish equivalent (→ line_items.colour_finish).
// Not every category has a clean match for either — see the conversation this
// came out of: woodwork/stone & glass/flooring have no real colour field, and
// several categories don't have a tidy three-axis size. Where there's no
// match, that column is simply left blank — never guessed or fabricated.
const SIZE_FIELD_KEYS: Record<CategoryKey, string[]> = {
  general: [],
  furniture: ['overall_width', 'overall_depth', 'overall_height'],
  woodwork: ['overall_width', 'overall_depth', 'overall_height'],
  stone_glass: ['width', 'height', 'length'],
  lighting: ['diameter', 'height'],
  flooring: ['board_width', 'board_length'],
  wall_finishes: ['width', 'height'],
  cushions: ['width', 'depth', 'height'],
  accessories: ['width', 'depth', 'height'],
}

const COLOUR_FIELD_KEY: Record<CategoryKey, string | null> = {
  general: null,
  furniture: 'colour_stain',
  woodwork: null,
  stone_glass: null,
  lighting: 'finish',
  flooring: null,
  wall_finishes: 'colour_pattern',
  cushions: 'colour',
  accessories: 'colour_finish',
}

export interface FormattedCategorySpecs {
  dimensions: string | null
  colourFinish: string | null
  extraText: string | null
}

// Splits a category's item_specs into what belongs in the quote/PO's
// existing dimensions/colour_finish columns vs. everything else — the
// "everything else" gets appended into the line item's free-text
// description instead. Deliberately no new structured columns on
// line_items; description already renders in full on the PO.
export function formatCategorySpecs(
  category: string,
  itemSpecs: Record<string, string> | null | undefined
): FormattedCategorySpecs {
  const specs = itemSpecs ?? {}
  const key = category as CategoryKey
  const fields = CATEGORY_FIELDS[key] ?? []
  if (!fields.length) return { dimensions: null, colourFinish: null, extraText: null }

  const sizeKeyList = SIZE_FIELD_KEYS[key] ?? []
  const sizeKeys = new Set(sizeKeyList)
  const colourKey = COLOUR_FIELD_KEY[key]

  const sizeValues = sizeKeyList.map(k => specs[k]?.trim()).filter((v): v is string => !!v)
  const dimensions = sizeValues.length ? sizeValues.join(' × ') : null

  const colourFinish = colourKey ? specs[colourKey]?.trim() || null : null

  const extraText =
    fields
      .filter(f => !sizeKeys.has(f.key) && f.key !== colourKey)
      .map(f => {
        const val = specs[f.key]?.trim()
        return val ? `${f.label}: ${val}` : null
      })
      .filter((v): v is string => !!v)
      .join(' · ') || null

  return { dimensions, colourFinish, extraText }
}
