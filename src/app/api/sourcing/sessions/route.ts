import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions — create a new session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { title: string; project_id?: string }
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('sourcing_sessions')
      .insert({
        org_id: orgId,
        user_id: user.id,
        project_id: body.project_id ?? null,
        title: body.title.trim(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
