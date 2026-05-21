import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/suppliers/[supplierId]/push-extra
// Body: { type: 'installation' | 'delivery', project_id, markup_percentage? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  try {
    const { id: session_id, supplierId: session_supplier_id } = await params
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

    const { type, project_id, markup_percentage } = await req.json() as {
      type: 'installation' | 'delivery'
      project_id: string
      markup_percentage?: number
    }
    if (!type || !project_id) return NextResponse.json({ error: 'type and project_id are required' }, { status: 400 })
    if (type !== 'installation' && type !== 'delivery') return NextResponse.json({ error: 'type must be installation or delivery' }, { status: 400 })

    // Fetch the session supplier to get the fee and supplier details
    const { data: ss } = await supabase
      .from('sourcing_session_suppliers')
      .select('supplier_id, supplier_name, installation_fee, delivery_fee, installation_pushed_project_id, delivery_pushed_project_id')
      .eq('id', session_supplier_id)
      .eq('session_id', session_id)
      .maybeSingle() as any

    if (!ss) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

    const fee = type === 'installation' ? ss.installation_fee : ss.delivery_fee
    if (!fee || fee <= 0) return NextResponse.json({ error: `No ${type} fee set for this supplier` }, { status: 400 })

    // Prevent double-push
    const alreadyPushedField = type === 'installation' ? 'installation_pushed_project_id' : 'delivery_pushed_project_id'
    if (ss[alreadyPushedField]) {
      return NextResponse.json({ error: `${type} fee already pushed to a project` }, { status: 409 })
    }

    // Fetch office address
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

    const sort_order = (lastItem?.sort_order ?? -1) + 1
    const markup = markup_percentage ?? 0

    const { data: lineItem, error } = await supabase
      .from('line_items')
      .insert({
        project_id,
        item_name: type === 'installation' ? 'Installation' : 'Delivery',
        description: null,
        quantity: 1,
        cost_price: fee,
        markup_percentage: markup,
        supplier_id: ss.supplier_id ?? null,
        supplier_name: ss.supplier_name ?? null,
        dimensions: null,
        colour_finish: null,
        lead_time_weeks: null,
        delivery_address: deliveryAddress,
        sort_order,
        row_type: 'item',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark as pushed
    await supabase
      .from('sourcing_session_suppliers')
      .update({ [alreadyPushedField]: project_id })
      .eq('id', session_supplier_id)

    return NextResponse.json({ data: lineItem })
  } catch (e) {
    return apiError(e)
  }
}
