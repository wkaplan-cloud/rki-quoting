import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions — create a new session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const [{ data: { user } }, { data: orgId }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('get_current_org_id'),
    ])
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json() as { title: string; project_id?: string; client_id?: string | null }
    if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const { data: maxRow } = await supabase
      .from('sourcing_sessions')
      .select('request_number')
      .eq('org_id', orgId)
      .not('request_number', 'is', null)
      .order('request_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextNumber = ((maxRow as any)?.request_number ?? 0) + 1

    const { data, error } = await supabase
      .from('sourcing_sessions')
      .insert({
        org_id: orgId,
        user_id: user.id,
        project_id: body.project_id ?? null,
        client_id: body.client_id ?? null,
        title: body.title.trim(),
        request_number: nextNumber,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return apiError(e)
  }
}
