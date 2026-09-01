'use client'
import type { CategoryKey } from '@/lib/sourcing-categories'
import { CATEGORY_FIELDS } from '@/lib/sourcing-categories'

// Renders the category-specific field set (CATEGORY_FIELDS) for whichever
// category is selected — shared between Pieces (catalog authoring) and
// Studio (board spec panel) so both stay driven by the exact same field
// definitions. Deliberately unstyled/unwrapped: each caller supplies its own
// input/label classes and wraps the output in its own layout (grid, list,
// whatever fits that surface), so this only owns the field-type switch.
//
// No placeholders anywhere: every field carries a visible label (with its unit),
// and example text in an empty box reads as content that is already there.
interface Props {
  category: CategoryKey
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  inputClassName: string
  labelClassName: string
  fieldWrapperClassName?: string
  // Textareas often need to span a wider layout (e.g. col-span-2 in a 2-col
  // grid) than single-line fields — defaults to fieldWrapperClassName.
  textareaWrapperClassName?: string
}

export function CategorySpecFields({
  category,
  values,
  onChange,
  inputClassName,
  labelClassName,
  fieldWrapperClassName = '',
  textareaWrapperClassName,
}: Props) {
  const fields = CATEGORY_FIELDS[category]
  if (!fields.length) return null

  return (
    <>
      {fields.map(field => {
        const val = values[field.key] ?? ''

        if (field.type === 'select') {
          return (
            <div key={field.key} className={fieldWrapperClassName}>
              <label className={labelClassName}>{field.label}</label>
              <select value={val} onChange={e => onChange(field.key, e.target.value)} className={inputClassName}>
                <option value="">—</option>
                {field.options!.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )
        }

        if (field.type === 'textarea') {
          return (
            <div key={field.key} className={textareaWrapperClassName ?? fieldWrapperClassName}>
              <label className={labelClassName}>{field.label}</label>
              <textarea
                value={val}
                onChange={e => onChange(field.key, e.target.value)}
                rows={2}
                className={`${inputClassName} resize-none`}
              />
            </div>
          )
        }

        return (
          <div key={field.key} className={fieldWrapperClassName}>
            <label className={labelClassName}>
              {field.label}
              {field.unit && <span className="opacity-60 ml-1">({field.unit})</span>}
            </label>
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              min={field.type === 'number' ? '0' : undefined}
              step={field.type === 'number' ? 'any' : undefined}
              value={val}
              onChange={e => onChange(field.key, e.target.value)}
              className={inputClassName}
            />
          </div>
        )
      })}
    </>
  )
}
