import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// PATCH /api/sourcing/[id] — update a draft request's fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership and draft status
  const { data: existing } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft requests can be edited' }, { status: 400 })
  }

  const body = await req.json() as {
    title?: string
    specifications?: string
    quantity?: number
    unit?: string
    dimensions?: string
    colour_finish?: string
  }

  const { data, error } = await supabase
    .from('sourcing_requests')
    .update({
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.specifications !== undefined && { specifications: body.specifications?.trim() || null }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.unit !== undefined && { unit: body.unit?.trim() || null }),
      ...(body.dimensions !== undefined && { dimensions: body.dimensions?.trim() || null }),
      ...(body.colour_finish !== undefined && { colour_finish: body.colour_finish?.trim() || null }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
