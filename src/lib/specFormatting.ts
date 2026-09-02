import { CATEGORY_FIELDS, type CategoryKey } from './sourcing-categories'

// Per category: which field(s) compose the "overall size" (→ line_items.dimensions)
// and which single field is the colour/finish equivalent (→ line_items.colour_finish).
// Not every category has a clean match for either — see the conversation this
// came out of: woodwork/stone & glass/flooring have no real colour field, and
// several categories don't have a tidy three-axis size. Where there's no
// match, that column is simply left blank — never guessed or fabricated.
// Each entry pairs the item_specs key with the short axis label the quote
// should read ("W", "D", "H", "L", "Ø"). Without them the joined string is a
// bare "450 × 900" that only the person who typed it can decode — and the
// axes differ per category (Lighting is diameter × height, Flooring is board
// width × length), so the label has to come from here, not be assumed.
const SIZE_FIELDS: Record<CategoryKey, { key: string; label: string }[]> = {
  general: [],
  furniture: [
    { key: 'overall_width',  label: 'W' },
    { key: 'overall_depth',  label: 'D' },
    { key: 'overall_height', label: 'H' },
  ],
  woodwork: [
    { key: 'overall_width',  label: 'W' },
    { key: 'overall_depth',  label: 'D' },
    { key: 'overall_height', label: 'H' },
  ],
  stone_glass: [
    { key: 'width',  label: 'W' },
    { key: 'height', label: 'H' },
    { key: 'length', label: 'L' },
  ],
  lighting: [
    { key: 'diameter', label: 'Ø' },
    { key: 'height',   label: 'H' },
  ],
  flooring: [
    { key: 'board_width',  label: 'W' },
    { key: 'board_length', label: 'L' },
  ],
  wall_finishes: [
    { key: 'width',  label: 'W' },
    { key: 'height', label: 'H' },
  ],
  cushions: [
    { key: 'width',  label: 'W' },
    { key: 'depth',  label: 'D' },
    { key: 'height', label: 'H' },
  ],
  accessories: [
    { key: 'width',  label: 'W' },
    { key: 'depth',  label: 'D' },
    { key: 'height', label: 'H' },
  ],
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

  const sizeFields = SIZE_FIELDS[key] ?? []
  const sizeKeys = new Set(sizeFields.map(f => f.key))
  const colourKey = COLOUR_FIELD_KEY[key]

  // "W 1800 × D 900 × H 750 mm" — axis labels so the reader doesn't have to
  // know the category's field order, and the unit appended once at the end.
  // Safe to append here (unlike the studio's free-text W/D/H boxes) because
  // every size field is a number input, so the value is always a bare number.
  const sized = sizeFields
    .map(f => ({ key: f.key, label: f.label, value: specs[f.key]?.trim() }))
    .filter((f): f is { key: string; label: string; value: string } => !!f.value)
  const sizeUnit = sized.length ? fields.find(f => f.key === sized[0].key)?.unit ?? '' : ''
  const dimensions = sized.length
    ? sized.map(f => `${f.label} ${f.value}`).join(' × ') + (sizeUnit ? ` ${sizeUnit}` : '')
    : null

  const colourFinish = colourKey ? specs[colourKey]?.trim() || null : null

  const extraText =
    fields
      .filter(f => !sizeKeys.has(f.key) && f.key !== colourKey)
      .map(f => {
        const val = specs[f.key]?.trim()
        // Unit carried through too — "Seat Height: 450" is as unreadable on a
        // quote as an unlabelled dimension string
        return val ? `${f.label}: ${val}${f.unit ? ` ${f.unit}` : ''}` : null
      })
      .filter((v): v is string => !!v)
      .join(' · ') || null

  return { dimensions, colourFinish, extraText }
}
