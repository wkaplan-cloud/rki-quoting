import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/capital-hotels/[requestId]/send-quote
// Creates a QuotingHub project + line items from all matched request items
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // Load the request and its items
    const { data: request } = await supabase
      .from('capital_requests')
      .select('id, hotel_name, hotel_id, submitted_at')
      .eq('id', requestId)
      .single()

    if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const { data: items } = await supabase
      .from('capital_request_items')
      .select('*')
      .eq('request_id', requestId)
      .order('sort_order')

    if (!items?.length) return NextResponse.json({ error: 'No items found' }, { status: 400 })

    // Build project number
    const { data: lastProject } = await supabase
      .from('projects')
      .select('project_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let nextNumber = 'CAP-001'
    if (lastProject?.project_number) {
      const match = lastProject.project_number.match(/^(.*?)(\d+)$/)
      if (match) {
        const prefix = match[1]
        const digits = match[2]
        nextNumber = prefix + String(parseInt(digits) + 1).padStart(digits.length, '0')
      }
    }

    const date = new Date(request.submitted_at).toISOString().split('T')[0]
    const projectName = `${request.hotel_name} — ${new Date(request.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`

    // Get default settings for vat_rate, deposit_percentage
    const { data: settings } = await supabase
      .from('settings')
      .select('vat_rate, deposit_percentage')
      .maybeSingle()

    // Create the project
    const { data: project, error: projError } = await supabase
      .from('projects')
      .insert({
        org_id: orgId,
        user_id: user.id,
        project_number: nextNumber,
        project_name: projectName,
        date,
        status: 'Draft',
        design_fee: 0,
        vat_rate: settings?.vat_rate ?? 15,
        deposit_percentage: settings?.deposit_percentage ?? 50,
        notes: `Capital Hotel request from ${request.hotel_name}`,
      })
      .select('id')
      .single()

    if (projError || !project) return NextResponse.json({ error: projError?.message ?? 'Failed to create project' }, { status: 500 })

    // Create line items from each request item
    const lineItemRows = items.map((item, idx) => ({
      project_id: project.id,
      org_id: orgId,
      item_name: item.piece_name ?? item.description,
      description: item.description,
      quantity: item.quantity,
      supplier_id: item.supplier_id ?? null,
      supplier_name: item.supplier_name ?? null,
      cost_price: item.cost_price ?? 0,
      markup_percentage: item.markup_percentage ?? 0,
      row_type: 'item',
      indent_level: 0,
      sort_order: idx,
      received: false,
    }))

    await supabase.from('line_items').insert(lineItemRows)

    // Mark the request as quoted and link to project
    await supabase
      .from('capital_requests')
      .update({ status: 'quoted', quote_project_id: project.id })
      .eq('id', requestId)

    return NextResponse.json({ ok: true, project_id: project.id })
  } catch (e) {
    return apiError(e)
  }
}
