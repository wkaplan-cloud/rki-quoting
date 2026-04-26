import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/items/[itemId]/push
// Pushes accepted price into a project as a confirmed line item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id: session_id, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { project_id, markup_percentage } = await req.json() as {
      project_id: string
      markup_percentage?: number
    }
    if (!project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

    // Fetch item + accepted assignment + response
    const { data: item } = await supabase
      .from('sourcing_session_items')
      .select('*')
      .eq('id', itemId)
      .single()

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const { data: assignment } = await supabase
      .from('sourcing_item_assignments')
      .select('*, response:sourcing_item_responses(*), supplier:sourcing_session_suppliers(supplier_name, supplier_id)')
      .eq('item_id', itemId)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!assignment?.response) return NextResponse.json({ error: 'No accepted response found' }, { status: 400 })

    const response = Array.isArray(assignment.response) ? assignment.response[0] : assignment.response
    const supplierData = Array.isArray(assignment.supplier) ? assignment.supplier[0] : assignment.supplier

    // Get max sort_order in project
    const { data: lastItem } = await supabase
      .from('line_items')
      .select('sort_order')
      .eq('project_id', project_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sort_order = (lastItem?.sort_order ?? -1) + 1
    const markup = markup_percentage ?? 0

    const { data: lineItem, error } = await supabase
      .from('line_items')
      .insert({
        project_id,
        item_name: item.title,
        description: item.specifications ?? null,
        quantity: item.item_quantity ?? 1,
        cost_price: response.unit_price,
        markup_percentage: markup,
        supplier_id: supplierData?.supplier_id ?? null,
        supplier_name: supplierData?.supplier_name ?? null,
        dimensions: item.dimensions ?? null,
        colour_finish: item.colour_finish ?? null,
        lead_time_weeks: response.lead_time_weeks ?? null,
        sort_order,
        row_type: 'item',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update session status if all items are accepted
    const { data: openItems } = await supabase
      .from('sourcing_session_items')
      .select('id')
      .eq('session_id', session_id)
      .eq('status', 'open')

    if (!openItems?.length) {
      await supabase.from('sourcing_sessions').update({ status: 'completed' }).eq('id', session_id)
    }

    return NextResponse.json({ data: lineItem })
  } catch (e) {
    return apiError(e)
  }
}
