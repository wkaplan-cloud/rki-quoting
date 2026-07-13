import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { todaySA } from '@/lib/dates'
import type { StudioObject, MaterialEntry } from '@/lib/studio/types'

// POST /api/studio/boards/[id]/convert-to-project
// Pulls the board into a new quoting project: one section row per slide
// (its heading), one line item per APPROVED spec, in deck order. Draft
// specs are skipped. Items land unpriced (cost 0) — pricing happens in
// the project. Each spec is linked back to its line item, and the board
// to the project, so a board converts once.

interface ConvertSpecRow {
  id: string
  object_id: string
  spec_name: string
  description: string
  notes: string
  supplier_id: string | null
  supplier_name: string
  quantity: string
  unit: string
  width: string
  depth: string
  height: string
  materials: MaterialEntry[]
  status: string
}

interface SlideRow {
  id: string
  name: string
  heading: string
  sort_order: number
  objects: StudioObject[]
}

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
          'id, object_id, spec_name, description, notes, supplier_id, supplier_name, quantity, unit, width, depth, height, materials, status'
        )
        .eq('board_id', boardId),
    ])

    const specByObject = new Map(
      ((specs ?? []) as ConvertSpecRow[]).filter(s => s.status === 'approved').map(s => [s.object_id, s])
    )

    // Supplier default markups — mirrors what picking a supplier in the
    // line items table does, so pricing behaves the same once costs go in
    const supplierIds = [
      ...new Set([...specByObject.values()].map(s => s.supplier_id).filter((v): v is string => !!v)),
    ]
    const markupBySupplier = new Map<string, number>()
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from('suppliers')
        .select('id, markup_percentage')
        .in('id', supplierIds)
      for (const su of sups ?? []) markupBySupplier.set(su.id, su.markup_percentage ?? 0)
    }

    // Build rows in deck order: section per slide, items beneath.
    // Only specs whose object still exists on a slide count — spec rows for
    // deleted objects are cleaned up lazily and must not become line items.
    type Row = Record<string, unknown>
    const rows: Row[] = []
    const specIdForRow: (string | null)[] = []
    let itemCount = 0
    ;((slides ?? []) as SlideRow[]).forEach((slide, i) => {
      const objects = Array.isArray(slide.objects) ? slide.objects : []
      const specced = objects.filter(o => specByObject.has(o.id))
      if (!specced.length) return

      rows.push({
        item_name: slide.heading.trim() || slide.name.trim() || `Slide ${i + 1}`,
        description: '',
        quantity: 0,
        cost_price: 0,
        markup_percentage: 0,
        row_type: 'section',
        indent_level: 0,
      })
      specIdForRow.push(null)

      for (const obj of specced) {
        const sp = specByObject.get(obj.id)!
        const dimensions = [
          sp.width.trim() && `W ${sp.width.trim()}`,
          sp.depth.trim() && `D ${sp.depth.trim()}`,
          sp.height.trim() && `H ${sp.height.trim()}`,
        ]
          .filter(Boolean)
          .join(' × ')
        const materials = (Array.isArray(sp.materials) ? sp.materials : [])
          .map(m => (m.type && m.description ? `${m.type}: ${m.description}` : m.description || m.type))
          .filter(Boolean)
          .join('; ')

        rows.push({
          item_name: sp.spec_name.trim() || 'Untitled item',
          description: [sp.description.trim(), sp.notes.trim()].filter(Boolean).join('\n') || null,
          quantity: parseFloat(sp.quantity) || 1,
          unit: sp.unit.trim() || null,
          supplier_id: sp.supplier_id,
          supplier_name: sp.supplier_name.trim() || null,
          cost_price: 0,
          markup_percentage: sp.supplier_id ? (markupBySupplier.get(sp.supplier_id) ?? 0) : 0,
          dimensions: dimensions || null,
          colour_finish: materials || null,
          row_type: 'item',
          indent_level: 0,
        })
        specIdForRow.push(sp.id)
        itemCount++
      }
    })

    if (!itemCount) {
      return NextResponse.json({ error: 'No approved specs to convert' }, { status: 400 })
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

    const withProject = rows.map((r, i) => ({ ...r, project_id: project.id, sort_order: i }))
    const { data: inserted, error: liErr } = await supabase
      .from('line_items')
      .insert(withProject)
      .select('id')
    if (liErr || !inserted || inserted.length !== withProject.length) {
      // Don't leave a half-built project behind
      await supabase.from('projects').delete().eq('id', project.id)
      return NextResponse.json({ error: liErr?.message ?? 'Failed to create line items' }, { status: 500 })
    }

    // Link each spec to its line item, and the board to the project
    await Promise.all(
      specIdForRow.map((specId, i) =>
        specId
          ? supabase.from('studio_specs').update({ line_item_id: inserted[i].id }).eq('id', specId)
          : Promise.resolve(null)
      )
    )
    await supabase.from('studio_boards').update({ project_id: project.id }).eq('id', boardId)

    return NextResponse.json({ projectId: project.id, itemCount })
  } catch (e) {
    return apiError(e)
  }
}
