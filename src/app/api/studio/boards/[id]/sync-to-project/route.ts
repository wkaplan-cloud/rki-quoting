import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import {
  buildSpecByObject,
  loadPricingContext,
  buildBoardRows,
  type ConvertSpecRow,
  type SlideRow,
} from '@/lib/studio/convertToLineItems'
import type { StudioObject } from '@/lib/studio/types'

// Sync an already-converted board into its quote. Additive by design:
//   • specs added to the board since conversion  → appended as new line items
//   • objects removed from the board             → offered for removal, never
//                                                   deleted automatically
// Existing rows (their pricing, names, order, and any manually added rows) are
// never touched. Locked once the quote leaves Draft — a sent quote must not
// change under the client. Identity is the studio_object_id breadcrumb every
// converted item row carries (see convert-to-project + studio_line_item_links).

interface Diff {
  projectId: string
  projectNumber: string | null
  locked: boolean
  // Board specs not yet on the quote — will be added
  added: { name: string }[]
  // Quote rows whose board object is gone — candidates for removal
  removed: { lineItemId: string; name: string }[]
}

// Shared loader: resolves the board's linked project and diffs board specs
// against the quote's board-originated line items.
async function loadDiff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<
  | { error: string; status: number }
  | {
      projectId: string
      projectNumber: string | null
      locked: boolean
      slides: SlideRow[]
      specByObject: ReturnType<typeof buildSpecByObject>
      liveObjectIds: Set<string>
      newObjectIds: Set<string>
      addedSpecs: ConvertSpecRow[]
      removableRows: { lineItemId: string; name: string }[]
    }
> {
  const { data: board } = await supabase
    .from('studio_boards')
    .select('id, project_id')
    .eq('id', boardId)
    .maybeSingle()
  if (!board) return { error: 'Not found', status: 404 }
  if (!board.project_id) return { error: "This board isn't linked to a quote yet", status: 400 }

  const { data: project } = await supabase
    .from('projects')
    .select('id, project_number, status')
    .eq('id', board.project_id)
    .maybeSingle()
  if (!project) return { error: 'The linked quote no longer exists', status: 404 }

  const [{ data: slides }, { data: specs }, { data: existing }] = await Promise.all([
    supabase
      .from('studio_slides')
      .select('id, name, heading, sort_order, objects')
      .eq('board_id', boardId)
      .order('sort_order'),
    supabase
      .from('studio_specs')
      .select(
        'id, object_id, spec_name, description, notes, supplier_id, supplier_name, quantity, unit, width, depth, height, materials, scatters, status, category, item_specs'
      )
      .eq('board_id', boardId),
    supabase
      .from('line_items')
      .select('id, item_name, studio_object_id')
      .eq('project_id', board.project_id)
      .eq('row_type', 'item')
      .eq('indent_level', 0)
      .not('studio_object_id', 'is', null),
  ])

  const specByObject = buildSpecByObject((specs ?? []) as ConvertSpecRow[])

  // Objects still live on a slide AND carrying a spec — the current truth of
  // the board. Mirrors what convert and the Specs panel treat as real.
  const liveObjectIds = new Set<string>()
  for (const slide of (slides ?? []) as SlideRow[]) {
    const objects = Array.isArray(slide.objects) ? (slide.objects as StudioObject[]) : []
    for (const o of objects) if (specByObject.has(o.id)) liveObjectIds.add(o.id)
  }

  const existingObjectIds = new Set(
    ((existing ?? []) as { studio_object_id: string | null }[])
      .map(r => r.studio_object_id)
      .filter((v): v is string => !!v)
  )

  // New = live on the board but not yet on the quote
  const newObjectIds = new Set([...liveObjectIds].filter(id => !existingObjectIds.has(id)))
  const addedSpecs = [...newObjectIds].map(id => specByObject.get(id)!).filter(Boolean)

  // Removable = on the quote but no longer live on the board
  const removableRows = ((existing ?? []) as { id: string; item_name: string | null; studio_object_id: string | null }[])
    .filter(r => r.studio_object_id && !liveObjectIds.has(r.studio_object_id))
    .map(r => ({ lineItemId: r.id, name: r.item_name?.trim() || 'Untitled item' }))

  return {
    projectId: project.id,
    projectNumber: (project.project_number as string | null) ?? null,
    locked: project.status !== 'Draft',
    slides: (slides ?? []) as SlideRow[],
    specByObject,
    liveObjectIds,
    newObjectIds,
    addedSpecs,
    removableRows,
  }
}

// GET — preview only, writes nothing.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await loadDiff(supabase, boardId)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

    const diff: Diff = {
      projectId: res.projectId,
      projectNumber: res.projectNumber,
      locked: res.locked,
      added: res.addedSpecs.map(s => ({ name: s.spec_name.trim() || 'Untitled item' })),
      removed: res.removableRows,
    }
    return NextResponse.json(diff)
  } catch (e) {
    return apiError(e)
  }
}

// POST — apply: append new items, delete only the confirmed removals.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const body = await req.json().catch(() => ({}))
    const requestedRemovals: string[] = Array.isArray(body.removeLineItemIds)
      ? body.removeLineItemIds.filter((v: unknown): v is string => typeof v === 'string')
      : []

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await loadDiff(supabase, boardId)
    if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
    if (res.locked) {
      return NextResponse.json(
        { error: "This quote has already been sent, so it can't be updated from the board" },
        { status: 409 }
      )
    }

    const { projectId, slides, specByObject, newObjectIds, removableRows } = res

    // --- Additions -------------------------------------------------------
    let addedCount = 0
    if (newObjectIds.size) {
      const { markupBySupplier, priceByProductId, defaultDeliveryAddress } = await loadPricingContext(
        supabase,
        specByObject
      )

      // Append after everything already on the quote so existing ordering is
      // never disturbed. New items come grouped under a fresh section header
      // per source slide, at the bottom of the quote.
      const { data: last } = await supabase
        .from('line_items')
        .select('sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const startSortOrder = ((last?.sort_order as number | null) ?? -1) + 1

      const { parents, parentMeta, itemCount } = buildBoardRows({
        slides,
        specByObject,
        markupBySupplier,
        priceByProductId,
        defaultDeliveryAddress,
        startSortOrder,
        includeObject: id => newObjectIds.has(id),
      })

      if (itemCount) {
        // Pass 1: sections + items — returned in insert order, giving us ids
        const parentRows = parents.map(r => ({ ...r, project_id: projectId }))
        const { data: inserted, error: liErr } = await supabase
          .from('line_items')
          .insert(parentRows)
          .select('id')
        if (liErr || !inserted || inserted.length !== parentRows.length) {
          return NextResponse.json({ error: liErr?.message ?? 'Failed to add line items' }, { status: 500 })
        }

        // Pass 2: material children, now that their parents have ids
        const childRows = parentMeta.flatMap((meta, i) =>
          meta.materials.map(m => ({ ...m, project_id: projectId, parent_item_id: inserted[i].id }))
        )
        if (childRows.length) {
          const { error: childErr } = await supabase.from('line_items').insert(childRows)
          if (childErr) return NextResponse.json({ error: childErr.message }, { status: 500 })
        }

        // Link each new spec back to its line item
        await Promise.all(
          parentMeta.map((meta, i) =>
            meta.specId
              ? supabase.from('studio_specs').update({ line_item_id: inserted[i].id }).eq('id', meta.specId)
              : Promise.resolve(null)
          )
        )
        addedCount = itemCount
      }
    }

    // --- Removals --------------------------------------------------------
    // Only delete ids the caller confirmed AND that the diff actually marked
    // removable — never trust the client to name arbitrary rows. Delete the
    // item's material children first (parent_item_id is ON DELETE SET NULL,
    // so children would otherwise be orphaned onto the quote).
    const removableIds = new Set(removableRows.map(r => r.lineItemId))
    const toRemove = requestedRemovals.filter(id => removableIds.has(id))
    let removedCount = 0
    if (toRemove.length) {
      await supabase.from('line_items').delete().in('parent_item_id', toRemove)
      const { error: delErr, count } = await supabase
        .from('line_items')
        .delete({ count: 'exact' })
        .in('id', toRemove)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
      removedCount = count ?? toRemove.length
    }

    return NextResponse.json({ projectId, added: addedCount, removed: removedCount })
  } catch (e) {
    return apiError(e)
  }
}
