/**
 * Drag-to-reorder for the project line items table. Dragging an item moves
 * that one row; dragging a section heading moves the heading and every item
 * under it (up to the next heading) as one block.
 */
type Row = { row_type: string }

export function reorderRows<T extends Row>(rows: T[], from: number, to: number): T[] {
  if (from === to) return rows
  const reordered = [...rows]
  if (rows[from].row_type !== 'section') {
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    return reordered
  }

  let end = from + 1
  while (end < rows.length && rows[end].row_type !== 'section') end++
  if (to > from && to < end) return rows

  // Land on a section boundary so the block never splits another section
  // or swallows the loose items above the first heading
  let target: number
  if (to < from) {
    target = to
    while (target >= 0 && rows[target].row_type !== 'section') target--
    if (target < 0) target = rows.findIndex(r => r.row_type === 'section')
  } else {
    let next = to + 1
    while (next < rows.length && rows[next].row_type !== 'section') next++
    target = next - (end - from)
  }
  const block = reordered.splice(from, end - from)
  reordered.splice(target, 0, ...block)
  return reordered
}
