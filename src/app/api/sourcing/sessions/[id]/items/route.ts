import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/items — add an item to a session
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: session_id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      title: string
      work_type?: string
      specifications?: string
      item_quantity?: number
      dimensions?: string
      colour_finish?: string
      line_item_id?: string
    }
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('sourcing_session_items')
      .select('sort_order')
      .eq('session_id', session_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sort_order = (existing?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('sourcing_session_items')
      .insert({
        session_id,
        title: body.title.trim(),
        work_type: body.work_type ?? null,
        specifications: body.specifications?.trim() ?? null,
        item_quantity: body.item_quantity ?? null,
        dimensions: body.dimensions?.trim() ?? null,
        colour_finish: body.colour_finish?.trim() ?? null,
        line_item_id: body.line_item_id ?? null,
        sort_order,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
