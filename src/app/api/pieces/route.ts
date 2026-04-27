import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// GET /api/pieces — list all pieces for current org
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data, error } = await supabase
      .from('pieces')
      .select('*, supplier:suppliers(id, supplier_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// POST /api/pieces — create a new piece
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as {
      name: string
      description?: string
      work_type?: string
      dimensions?: string
      colour_finish?: string
      year?: number
      supplier_id?: string
      supplier_name?: string
      base_price?: number
    }

    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('pieces')
      .insert({
        org_id: orgId,
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        work_type: body.work_type?.trim() ?? null,
        dimensions: body.dimensions?.trim() ?? null,
        colour_finish: body.colour_finish?.trim() ?? null,
        year: body.year ?? null,
        supplier_id: body.supplier_id ?? null,
        supplier_name: body.supplier_name?.trim() ?? null,
        base_price: body.base_price ?? null,
        image_urls: [],
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
