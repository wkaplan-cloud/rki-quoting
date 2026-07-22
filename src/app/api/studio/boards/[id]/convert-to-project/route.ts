import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { todaySA } from '@/lib/dates'
import { normalizeMaterial, type StudioObject, type MaterialEntry } from '@/lib/studio/types'
import { formatCategorySpecs } from '@/lib/specFormatting'

// POST /api/studio/boards/[id]/convert-to-project
// Pulls the board into a new quoting project: one section row per slide
// (its heading), one line item per spec (draft or approved — status only
// warns in the confirm modal, it never blocks conversion), and one child
// line item per material/finish entry (fabric, stone, glass…) indented
// under its item — all in deck order. Everything lands unpriced (cost 0)
// — pricing happens in the project. Each spec is linked back to its line
// item, and the board to the project, so a board converts once. Every row
// also stores studio_slide_id (+ studio_object_id on item rows) — hidden
// breadcrumbs so a future feature can jump from a quote line straight back
// to the object in Studio (supabase/migrations/studio_line_item_links.sql).

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
  category: string
  item_specs: Record<string, string> | null
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

    const [{ data: slides }, { data: specs }, { data: settings }] = await Promise.all([
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
      supabase.from('settings').select('business_name, business_address').maybeSingle(),
    ])

    // Same office-address default every other "add to quote" path uses
    // (LineItemsTable's addRow/insertRowBefore, pieces add-to-quote) — without
    // it these rows fall back to the column default instead of the org's
    // actual delivery address.
    const defaultDeliveryAddress = settings?.business_address
      ? `${settings.business_name ?? ''}\n${settings.business_address}`.trim()
      : ''

    // Status is a heads-up, not a gate — the confirm modal warns when drafts
    // remain, but every spec converts regardless of draft/approved
    const specByObject = new Map(
      ((specs ?? []) as ConvertSpecRow[]).map(s => [
        s.object_id,
        { ...s, materials: (s.materials ?? []).map(normalizeMaterial) },
      ])
    )

    // Supplier default markups — mirrors what picking a supplier in the line
    // items table does, so pricing behaves the same once costs go in. Covers
    // both the spec's own supplier and any supplier chosen on a material.
    const supplierIds = [
      ...new Set(
        [...specByObject.values()].flatMap(s => [
          s.supplier_id,
          ...s.materials.map(m => m.supplierId),
        ]).filter((v): v is string => !!v)
      ),
    ]
    const markupBySupplier = new Map<string, number>()
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from('suppliers')
        .select('id, markup_percentage')
        .in('id', supplierIds)
      for (const su of sups ?? []) markupBySupplier.set(su.id, su.markup_percentage ?? 0)
    }

    // Live fabric pricing: a spec can sit in draft for weeks before a board
    // is quoted, so price is never stored on the material — fetch the
    // CURRENT price list price right now, at the moment of quoting.
    const productIds = [
      ...new Set(
        [...specByObject.values()]
          .flatMap(s => s.materials.map(m => m.twinbruProductId))
          .filter((v): v is number => v != null)
      ),
    ]
    const priceByProductId = new Map<string, { price: number | null; imageUrl: string | null; widthCm: number | null }>()
    if (productIds.length) {
      const { data: items } = await supabase
        .from('price_list_items')
        .select('product_id, price_zar, image_url, useable_width_cm')
        .in('product_id', productIds.map(String))
      for (const it of items ?? []) {
        priceByProductId.set(it.product_id as string, {
          price: (it.price_zar as number | null) ?? null,
          imageUrl: (it.image_url as string | null) ?? null,
          widthCm: (it.useable_width_cm as number | null) ?? null,
        })
      }
    }

    // Build rows in deck order: section per slide, items beneath, and each
    // item's materials as child rows directly under it. Only specs whose
    // object still exists on a slide count — spec rows for deleted objects
    // are cleaned up lazily and must not become line items.
    // Materials need parent_item_id, which only exists after the parent is
    // inserted — so parents carry pre-assigned sort_orders with gaps their
    // children fill in a second insert.
    type Row = Record<string, unknown>
    const parents: Row[] = []
    const parentMeta: { specId: string | null; materials: Row[] }[] = []
    let itemCount = 0
    let sortOrder = 0
    ;((slides ?? []) as SlideRow[]).forEach((slide, i) => {
      const objects = Array.isArray(slide.objects) ? slide.objects : []
      const specced = objects.filter(o => specByObject.has(o.id))
      if (!specced.length) return

      parents.push({
        item_name: slide.heading.trim() || slide.name.trim() || `Slide ${i + 1}`,
        description: '',
        quantity: 0,
        cost_price: 0,
        markup_percentage: 0,
        row_type: 'section',
        indent_level: 0,
        sort_order: sortOrder++,
        studio_slide_id: slide.id,
      })
      parentMeta.push({ specId: null, materials: [] })

      for (const obj of specced) {
        const sp = specByObject.get(obj.id)!
        const genericDimensions = [
          sp.width.trim() && `W ${sp.width.trim()}`,
          sp.depth.trim() && `D ${sp.depth.trim()}`,
          sp.height.trim() && `H ${sp.height.trim()}`,
        ]
          .filter(Boolean)
          .join(' × ')

        // Category-specific fields (from Pieces or filled in directly on the
        // spec) take priority for size/colour when present; the generic
        // Dimensions section on the spec panel is the fallback. Everything
        // else in the category fields — seat height, wood type, etc. — has
        // nowhere structured to live on a line item, so it's appended into
        // the description instead (see specFormatting.ts).
        const { dimensions: categoryDimensions, colourFinish, extraText } = formatCategorySpecs(sp.category, sp.item_specs)
        const dimensions = categoryDimensions || genericDimensions || null
        const description =
          [sp.description.trim(), sp.notes.trim(), extraText].filter(Boolean).join('\n') || null

        parents.push({
          item_name: sp.spec_name.trim() || 'Untitled item',
          description,
          quantity: parseFloat(sp.quantity) || 1,
          unit: sp.unit.trim() || null,
          supplier_id: sp.supplier_id,
          supplier_name: sp.supplier_name.trim() || null,
          cost_price: 0,
          markup_percentage: sp.supplier_id ? (markupBySupplier.get(sp.supplier_id) ?? 0) : 0,
          dimensions,
          colour_finish: colourFinish,
          delivery_address: defaultDeliveryAddress,
          row_type: 'item',
          indent_level: 0,
          sort_order: sortOrder++,
          studio_slide_id: slide.id,
          studio_object_id: obj.id,
        })
        itemCount++

        // Fabric/stone/glass etc. become their own line items under the
        // item — quoted and procured separately, like manually linked rows.
        // A fabric material carries its supplier's markup and a LIVE price
        // looked up just now, never whatever the price list showed when the
        // spec was drafted.
        const materials = (Array.isArray(sp.materials) ? sp.materials : [])
          .map(m => {
            const live = m.twinbruProductId != null ? priceByProductId.get(String(m.twinbruProductId)) : undefined
            return {
              item_name: [m.type.trim(), m.description.trim()].filter(Boolean).join(' — ') || 'Material',
              description: null,
              quantity: 1,
              unit: m.twinbruProductId != null ? 'm' : null,
              supplier_id: m.supplierId,
              supplier_name: m.supplierName.trim() || null,
              cost_price: live?.price ?? 0,
              markup_percentage: m.supplierId ? (markupBySupplier.get(m.supplierId) ?? 0) : 0,
              colour_finish: m.colour,
              fabric_image_url: live?.imageUrl ?? m.imageUrl,
              twinbru_product_id: m.twinbruProductId,
              twinbru_cost_price: live?.price ?? null,
              fabric_width_cm: live?.widthCm ?? m.widthCm,
              delivery_address: defaultDeliveryAddress,
              row_type: 'item',
              indent_level: 1,
              sort_order: sortOrder++,
              studio_slide_id: slide.id,
              studio_object_id: obj.id,
            }
          })
        parentMeta.push({ specId: sp.id, materials })
      }
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

    // Pass 1: sections + items — returned in insert order, giving us ids
    const parentRows = parents.map(r => ({ ...r, project_id: project.id }))
    const { data: inserted, error: liErr } = await supabase
      .from('line_items')
      .insert(parentRows)
      .select('id')
    if (liErr || !inserted || inserted.length !== parentRows.length) {
      // Don't leave a half-built project behind
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
        await supabase.from('projects').delete().eq('id', project.id)
        return NextResponse.json({ error: childErr.message }, { status: 500 })
      }
    }

    // Link each spec to its line item, and the board to the project
    await Promise.all(
      parentMeta.map((meta, i) =>
        meta.specId
          ? supabase.from('studio_specs').update({ line_item_id: inserted[i].id }).eq('id', meta.specId)
          : Promise.resolve(null)
      )
    )
    await supabase.from('studio_boards').update({ project_id: project.id }).eq('id', boardId)

    return NextResponse.json({ projectId: project.id, itemCount, materialCount: childRows.length })
  } catch (e) {
    return apiError(e)
  }
}
