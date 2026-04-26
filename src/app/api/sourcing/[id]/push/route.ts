import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/[id]/push — push accepted response into a project as a new line item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id } = await req.json() as { project_id: string }
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Fetch the sourcing request with the accepted response
  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'accepted') {
    return NextResponse.json({ error: 'Request must be accepted before pushing to a quote' }, { status: 400 })
  }
  if (request.pushed_at) {
    return NextResponse.json({ error: 'Request has already been pushed to a quote' }, { status: 400 })
  }
  if (!request.accepted_response_id) {
    return NextResponse.json({ error: 'No accepted response found' }, { status: 400 })
  }

  // Verify the project belongs to this user
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch the accepted response + winning recipient (for supplier info + markup)
  const { data: response } = await supabase
    .from('sourcing_request_responses')
    .select('*, sourcing_request_recipients(supplier_id, supplier_name)')
    .eq('id', request.accepted_response_id)
    .single()

  if (!response) return NextResponse.json({ error: 'Accepted response not found' }, { status: 404 })

  const recipient = response.sourcing_request_recipients as {
    supplier_id: string | null
    supplier_name: string
  } | null

  // Look up supplier's default markup
  let markupPercentage = 40
  if (recipient?.supplier_id) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('markup_percentage')
      .eq('id', recipient.supplier_id)
      .single()
    if (supplier) markupPercentage = supplier.markup_percentage
  }

  // Fetch studio's default delivery address from settings
  const { data: settings } = await supabase
    .from('settings')
    .select('business_address')
    .maybeSingle()
  const deliveryAddress = settings?.business_address || null

  // Determine sort_order (append to end)
  const { count } = await supabase
    .from('line_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project_id)

  const sortOrder = (count ?? 0)

  // Create the new line item
  const { data: lineItem, error } = await supabase
    .from('line_items')
    .insert({
      project_id,
      item_name: request.title,
      description: [request.specifications, response.notes].filter(Boolean).join('\n') || null,
      quantity: request.quantity,
      unit: request.unit || null,
      dimensions: request.dimensions || null,
      colour_finish: request.colour_finish || null,
      supplier_id: recipient?.supplier_id || null,
      supplier_name: recipient?.supplier_name || null,
      cost_price: response.unit_price,
      markup_percentage: markupPercentage,
      lead_time_weeks: response.lead_time_weeks || null,
      delivery_address: deliveryAddress,
      sort_order: sortOrder,
      row_type: 'item',
      indent_level: 0,
      received: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stamp the sourcing request as pushed
  await supabase
    .from('sourcing_requests')
    .update({
      status: 'pushed',
      pushed_at: new Date().toISOString(),
      project_id,
    })
    .eq('id', id)

  return NextResponse.json({ success: true, line_item_id: lineItem.id })
  } catch (e) {
    return apiError(e)
  }
}
