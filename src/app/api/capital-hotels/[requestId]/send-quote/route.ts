import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/capital-hotels/[requestId]/send-quote
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

    const { data: request } = await supabase
      .from('capital_requests')
      .select('id, hotel_name, submitted_at')
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
        nextNumber = match[1] + String(parseInt(match[2]) + 1).padStart(match[2].length, '0')
      }
    }

    const date = new Date(request.submitted_at).toISOString().split('T')[0]
    const projectName = `${request.hotel_name} — ${new Date(request.submitted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`

    const { data: settings } = await supabase
      .from('settings')
      .select('vat_rate, deposit_percentage')
      .maybeSingle()

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

    // Build rich line item descriptions from all available fields
    const lineItemRows = items.map((item, idx) => {
      // item_name: "Piece Name — Variant Label" or just piece name or hotel description
      const itemName = item.piece_name
        ? item.variant_label
          ? `${item.piece_name} — ${item.variant_label}`
          : item.piece_name
        : item.description

      // description: hotel's original request + fabric + dimensions
      const descParts: string[] = [item.description]
      if (item.fabric) descParts.push(`Fabric: ${item.fabric}`)
      if (item.dimensions) descParts.push(`Dimensions: ${item.dimensions}`)
      const description = descParts.join('\n')

      return {
        project_id: project.id,
        org_id: orgId,
        item_name: itemName,
        description,
        quantity: item.quantity,
        supplier_id: item.supplier_id ?? null,
        supplier_name: item.supplier_name ?? null,
        cost_price: item.cost_price ?? 0,
        markup_percentage: item.markup_percentage ?? 0,
        fabric_image_url: item.piece_image_url ?? null,
        row_type: 'item',
        indent_level: 0,
        sort_order: idx,
        received: false,
      }
    })

    await supabase.from('line_items').insert(lineItemRows)

    await supabase
      .from('capital_requests')
      .update({ status: 'quoted', quote_project_id: project.id })
      .eq('id', requestId)

    return NextResponse.json({ ok: true, project_id: project.id })
  } catch (e) {
    return apiError(e)
  }
}
