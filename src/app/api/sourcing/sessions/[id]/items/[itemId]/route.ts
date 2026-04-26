import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string; itemId: string }> }

// PATCH /api/sourcing/sessions/[id]/items/[itemId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      title?: string
      work_type?: string | null
      specifications?: string | null
      item_quantity?: number | null
      dimensions?: string | null
      colour_finish?: string | null
    }

    const { data, error } = await supabase
      .from('sourcing_session_items')
      .update({
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.work_type !== undefined && { work_type: body.work_type }),
        ...(body.specifications !== undefined && { specifications: body.specifications?.trim() ?? null }),
        ...(body.item_quantity !== undefined && { item_quantity: body.item_quantity }),
        ...(body.dimensions !== undefined && { dimensions: body.dimensions?.trim() ?? null }),
        ...(body.colour_finish !== undefined && { colour_finish: body.colour_finish?.trim() ?? null }),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/sourcing/sessions/[id]/items/[itemId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('sourcing_session_items').delete().eq('id', itemId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
