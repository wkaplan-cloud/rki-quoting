import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { todaySA } from '@/lib/dates'
import {
  buildSpecByObject,
  loadPricingContext,
  buildBoardRows,
  type ConvertSpecRow,
  type SlideRow,
} from '@/lib/studio/convertToLineItems'

// POST /api/studio/boards/[id]/convert-to-project
// Pulls the board into a new quoting project: one section row per slide
// (its heading), one line item per spec (draft or approved — status only
// warns in the confirm modal, it never blocks conversion), and one child
// line item per material/finish entry (fabric, stone, glass…) indented
// under its item — all in deck order. Everything lands unpriced (cost 0)
// — pricing happens in the project. Each spec is linked back to its line
// item, and the board to the project, so a board converts once. Every row
// also stores studio_slide_id (+ studio_object_id on item rows) — hidden
// breadcrumbs used by sync-to-project to add board items to the quote later
// (supabase/migrations/studio_line_item_links.sql).

// Same increment logic as src/lib/projectNumber.ts, against the server client
function incrementProjectNumber(value: string): string | null {
  const match = value.match(/^(.*?)(\d+)\D*$/)
  if (!match) return null
  const [, prefix, digits] = match
  const next = String(parseInt(digits, 10) + 1).padStart(digits.length, '0')
  return prefix + next
}

async function nextProjectNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from('projects')
    .select('project_number')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.project_number) return null
  let candidate = data.project_number as string
  for (let i = 0; i < 50; i++) {
    const next = incrementProjectNumber(candidate)
    if (!next) return null
    candidate = next
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('project_number', candidate)
      .maybeSingle()
    if (!existing) return candidate
  }
  return candidate
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const body = await req.json().catch(() => ({}))
    const projectName =
      typeof body.projectName === 'string' && body.projectName.trim() ? body.projectName.trim() : null

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // RLS client scopes every read/write to the caller's org
    const { data: board } = await supabase
      .from('studio_boards')
      .select('id, name, client_id, project_id')
      .eq('id', boardId)
      .maybeSingle()
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (board.project_id) {
      return NextResponse.json(
        { error: 'This board is already linked to a project', projectId: board.project_id },
        { status: 409 }
      )
    }

    const [{ data: slides }, { data: specs }] = await Promise.all([
      supabase
        .from('studio_slides')
        .select('id, name, heading, sort_order, objects')
        .eq('board_id', boardId)
        .order('sort_order'),
      supabase
        .from('studio_specs')
        .select(
          'id, object_id, spec_name, description, notes, supplier_id, supplier_name, quantity, unit, width, depth, height, materials, status, category, item_specs'
        )
        .eq('board_id', boardId),
    ])

    // Status is a heads-up, not a gate — the confirm modal warns when drafts
    // remain, but every spec converts regardless of draft/approved
    const specByObject = buildSpecByObject((specs ?? []) as ConvertSpecRow[])
    const { markupBySupplier, priceByProductId, defaultDeliveryAddress } = await loadPricingContext(
      supabase,
      specByObject
    )

    // Build every board row (convert takes the whole board — includeObject
    // defaults to true). Materials need parent_item_id, which only exists
    // after the parent is inserted, so parents carry pre-assigned sort_orders
    // with gaps their children fill in a second insert.
    const { parents, parentMeta, itemCount } = buildBoardRows({
      slides: (slides ?? []) as SlideRow[],
      specByObject,
      markupBySupplier,
      priceByProductId,
      defaultDeliveryAddress,
    })

    if (!itemCount) {
      return NextResponse.json({ error: 'No specs to convert' }, { status: 400 })
    }

    const projectNumber = (await nextProjectNumber(supabase)) ?? '001'
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        project_number: projectNumber,
        project_name: projectName ?? board.name,
        user_id: user.id,
        org_id: orgId,
        client_id: board.client_id,
        date: todaySA(),
        status: 'Draft',
        design_fee: 0,
      })
      .select('id')
      .single()
    if (projErr || !project) {
      return NextResponse.json({ error: projErr?.message ?? 'Failed to create project' }, { status: 500 })
    }

    // Atomic claim: the earlier project_id check above is read-then-write and
    // can't stop two concurrent conversions of the same board (both can pass
    // that check before either writes). This conditional update is the real
    // guard — only the request that actually flips project_id from null wins;
    // the loser deletes the project it just created and backs off with 409.
    const { data: claimed } = await supabase
      .from('studio_boards')
      .update({ project_id: project.id })
      .eq('id', boardId)
      .is('project_id', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      await supabase.from('projects').delete().eq('id', project.id)
      return NextResponse.json({ error: 'This board is already linked to a project' }, { status: 409 })
    }

    // Pass 1: sections + items — returned in insert order, giving us ids
    const parentRows = parents.map(r => ({ ...r, project_id: project.id }))
    const { data: inserted, error: liErr } = await supabase
      .from('line_items')
      .insert(parentRows)
      .select('id')
    if (liErr || !inserted || inserted.length !== parentRows.length) {
      // Don't leave a half-built project behind. The board is already
      // claimed by this project (on delete cascade would otherwise take the
      // board down with it), so unlink before deleting.
      await supabase.from('studio_boards').update({ project_id: null }).eq('id', boardId)
      await supabase.from('projects').delete().eq('id', project.id)
      return NextResponse.json({ error: liErr?.message ?? 'Failed to create line items' }, { status: 500 })
    }

    // Pass 2: material children, now that their parents have ids
    const childRows = parentMeta.flatMap((meta, i) =>
      meta.materials.map(m => ({ ...m, project_id: project.id, parent_item_id: inserted[i].id }))
    )
    if (childRows.length) {
      const { error: childErr } = await supabase.from('line_items').insert(childRows)
      if (childErr) {
        await supabase.from('studio_boards').update({ project_id: null }).eq('id', boardId)
        await supabase.from('projects').delete().eq('id', project.id)
        return NextResponse.json({ error: childErr.message }, { status: 500 })
      }
    }

    // Link each spec to its line item (the board→project link is already
    // claimed above)
    await Promise.all(
      parentMeta.map((meta, i) =>
        meta.specId
          ? supabase.from('studio_specs').update({ line_item_id: inserted[i].id }).eq('id', meta.specId)
          : Promise.resolve(null)
      )
    )

    return NextResponse.json({ projectId: project.id, itemCount, materialCount: childRows.length })
  } catch (e) {
    return apiError(e)
  }
}
