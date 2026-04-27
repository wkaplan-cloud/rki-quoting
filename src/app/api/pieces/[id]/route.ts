import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/pieces/[id] — update a piece
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      name?: string
      description?: string
      work_type?: string
      dimensions?: string
      colour_finish?: string
      year?: number | null
      supplier_id?: string | null
      supplier_name?: string | null
      base_price?: number | null
      image_urls?: string[]
    }

    const { data, error } = await supabase
      .from('pieces')
      .update({
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
        ...(body.work_type !== undefined && { work_type: body.work_type?.trim() ?? null }),
        ...(body.dimensions !== undefined && { dimensions: body.dimensions?.trim() ?? null }),
        ...(body.colour_finish !== undefined && { colour_finish: body.colour_finish?.trim() ?? null }),
        ...(body.year !== undefined && { year: body.year }),
        ...(body.supplier_id !== undefined && { supplier_id: body.supplier_id }),
        ...(body.supplier_name !== undefined && { supplier_name: body.supplier_name?.trim() ?? null }),
        ...(body.base_price !== undefined && { base_price: body.base_price }),
        ...(body.image_urls !== undefined && { image_urls: body.image_urls }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/pieces/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('pieces')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
