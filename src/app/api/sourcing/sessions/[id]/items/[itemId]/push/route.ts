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

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { project_id, markup_percentage, overrides } = await req.json() as {
      project_id: string
      markup_percentage?: number
      overrides?: {
        item_name?: string
        description?: string
        quantity?: number
        dimensions?: string
        colour_finish?: string
      }
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

    // Fetch delivery_fee directly — avoids silent type-stripping from the join
    const { data: sessionSupplierRow } = await supabase
      .from('sourcing_session_suppliers')
      .select('delivery_fee')
      .eq('id', assignment.session_supplier_id)
      .maybeSingle()

    // Fetch office address for default delivery_address
    const { data: settings } = await supabase
      .from('settings')
      .select('business_name, business_address')
      .maybeSingle()

    const deliveryAddress = settings?.business_address
      ? `${settings.business_name ?? ''}\n${settings.business_address}`.trim()
      : ''

    // Get max sort_order in project
    const { data: lastItem } = await supabase
      .from('line_items')
      .select('sort_order')
      .eq('project_id', project_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    let sort_order = (lastItem?.sort_order ?? -1) + 1
    const markup = markup_percentage ?? 0

    const { data: lineItem, error } = await supabase
      .from('line_items')
      .insert({
        project_id,
        item_name: overrides?.item_name ?? item.title,
        description: overrides?.description ?? item.specifications ?? null,
        quantity: overrides?.quantity ?? item.item_quantity ?? 1,
        cost_price: response.unit_price,
        markup_percentage: markup,
        supplier_id: supplierData?.supplier_id ?? null,
        supplier_name: supplierData?.supplier_name ?? null,
        dimensions: overrides?.dimensions ?? item.dimensions ?? null,
        colour_finish: overrides?.colour_finish ?? item.colour_finish ?? null,
        lead_time_weeks: response.lead_time_weeks ?? null,
        delivery_address: deliveryAddress,
        sort_order,
        row_type: 'item',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Add installation line item if supplier quoted it separately
    const resp = response as typeof response & { installation_included?: boolean | null; installation_cost?: number | null }
    if (resp.installation_included === false && resp.installation_cost != null && resp.installation_cost > 0) {
      sort_order += 1
      await supabase.from('line_items').insert({
        project_id,
        item_name: 'Installation',
        description: null,
        quantity: 1,
        cost_price: resp.installation_cost,
        markup_percentage: markup,
        supplier_id: supplierData?.supplier_id ?? null,
        supplier_name: supplierData?.supplier_name ?? null,
        dimensions: null,
        colour_finish: null,
        lead_time_weeks: null,
        delivery_address: deliveryAddress,
        sort_order,
        row_type: 'item',
      })
    }

    // Add delivery line item — once per supplier per project
    const deliveryFee = (sessionSupplierRow as any)?.delivery_fee as number | null | undefined
    if (deliveryFee != null && deliveryFee > 0) {
      // Find all other items assigned to this same session supplier
      const { data: otherAssignments } = await supabase
        .from('sourcing_item_assignments')
        .select('item_id')
        .eq('session_supplier_id', assignment.session_supplier_id)
        .neq('item_id', itemId)

      const otherItemIds = (otherAssignments ?? []).map((a: { item_id: string }) => a.item_id)
      let deliveryAlreadyPushed = false
      if (otherItemIds.length > 0) {
        const { count } = await supabase
          .from('sourcing_session_items')
          .select('id', { count: 'exact', head: true })
          .eq('pushed_to_project_id', project_id)
          .in('id', otherItemIds)
        deliveryAlreadyPushed = (count ?? 0) > 0
      }

      if (!deliveryAlreadyPushed) {
        sort_order += 1
        await supabase.from('line_items').insert({
          project_id,
          item_name: 'Delivery',
          description: null,
          quantity: 1,
          cost_price: deliveryFee,
          markup_percentage: markup,
          supplier_id: supplierData?.supplier_id ?? null,
          supplier_name: supplierData?.supplier_name ?? null,
          dimensions: null,
          colour_finish: null,
          lead_time_weeks: null,
          delivery_address: deliveryAddress,
          sort_order,
          row_type: 'item',
        })
      }
    }

    // Record which project this item was pushed to so the UI persists after reload
    await supabase
      .from('sourcing_session_items')
      .update({ pushed_to_project_id: project_id })
      .eq('id', itemId)

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
