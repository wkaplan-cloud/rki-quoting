import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/sourcing/sessions/[id] — update title or project
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { title?: string; project_id?: string | null }

    // Explicit org_id filter provides defense-in-depth alongside RLS
    const { data, error } = await supabase
      .from('sourcing_sessions')
      .update({
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.project_id !== undefined && { project_id: body.project_id }),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/sourcing/sessions/[id] — permanently delete an archived session
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // Explicit org_id filter provides defense-in-depth alongside RLS
    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('archived')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!session.archived) return NextResponse.json({ error: 'Only archived sessions can be deleted' }, { status: 400 })

    await supabase.from('sourcing_sessions').delete().eq('id', id).eq('org_id', orgId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
