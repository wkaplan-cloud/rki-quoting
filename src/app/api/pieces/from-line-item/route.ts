import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/pieces/from-line-item — turn a line on a quote into a piece.
//
// The end of the loop. Pieces already flow INTO boards; this is how finished
// work comes back out of one: the item as it was actually specified, the price
// actually paid for it, and — the part that only exists at the end — the
// photograph of the real thing, taken when it was delivered.
//
// Everything is copied, never referenced. A piece outlives the quote it came
// from, so it must not go blank when that project is edited or deleted.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { lineItemId } = (await req.json().catch(() => ({}))) as { lineItemId?: string }
    if (!lineItemId) return NextResponse.json({ error: 'Missing lineItemId' }, { status: 400 })

    // line_items has no org_id — access comes through the parent project, so
    // this read going through the user's RLS client is what scopes it.
    const { data: item } = await supabase
      .from('line_items')
      .select('id, item_name, description, dimensions, colour_finish, supplier_id, supplier_name, cost_price, image_urls, fabric_image_url, studio_object_id, row_type')
      .eq('id', lineItemId)
      .maybeSingle()
    if (!item) return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    if (item.row_type !== 'item') {
      return NextResponse.json({ error: 'That row is a heading, not an item' }, { status: 400 })
    }
    if (!item.item_name?.trim()) {
      return NextResponse.json({ error: 'Give the line a name before saving it as a piece' }, { status: 400 })
    }

    // The richer detail lives on the spec the line came from, not on the line:
    // the category and its fields (seat height, wood type) never make it onto
    // a quote row. A line typed straight onto a quote simply has none.
    let category = 'general'
    let itemSpecs: Record<string, string> | null = null
    let specNotes = ''
    if (item.studio_object_id) {
      const { data: spec } = await supabase
        .from('studio_specs')
        .select('category, item_specs, notes')
        .eq('org_id', orgId)
        .eq('object_id', item.studio_object_id)
        .maybeSingle()
      if (spec) {
        category = (spec.category as string) || 'general'
        itemSpecs = (spec.item_specs as Record<string, string> | null) ?? null
        specNotes = ((spec.notes as string | null) ?? '').trim()
      }
    }

    // The designer's own photographs first. A catalogue picture from a price
    // list is the supplier's product shot, not this piece as it was made, so
    // it is only worth keeping when there is nothing else.
    const images: string[] = (item.image_urls ?? []).length
      ? (item.image_urls as string[])
      : item.fabric_image_url
        ? [item.fabric_image_url as string]
        : []

    const description = [item.description?.trim(), specNotes].filter(Boolean).join('\n') || null
    const costPrice = item.cost_price == null ? null : Number(item.cost_price)

    const { data: piece, error } = await supabase
      .from('pieces')
      .insert({
        org_id: orgId,
        user_id: user.id,
        name: item.item_name.trim(),
        description,
        category,
        item_specs: itemSpecs,
        dimensions: item.dimensions?.trim() || null,
        colour_finish: item.colour_finish?.trim() || null,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name?.trim() || null,
        // What it actually cost, not what it was quoted at
        base_price: costPrice,
        last_priced_at: costPrice != null ? new Date().toISOString() : null,
        year: new Date().getFullYear(),
        image_urls: images,
      })
      .select('id, name, image_urls')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ piece })
  } catch (e) {
    return apiError(e)
  }
}
