import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/sourcing/respond/[token]
// Public: supplier views their assigned items for a session
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('*, session:sourcing_sessions(id, title, status, project:projects(project_name))')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Mark viewed
    if (!ss.viewed_at) {
      await supabaseAdmin
        .from('sourcing_session_suppliers')
        .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
        .eq('id', ss.id)
    }

    // Get assigned items + existing responses
    const { data: assignments } = await supabaseAdmin
      .from('sourcing_item_assignments')
      .select('*, item:sourcing_session_items(*), response:sourcing_item_responses(*)')
      .eq('session_supplier_id', ss.id)
      .order('created_at', { ascending: true })

    const session = Array.isArray(ss.session) ? ss.session[0] : ss.session

    return NextResponse.json({
      data: {
        session_supplier: {
          id: ss.id,
          supplier_name: ss.supplier_name,
          status: ss.status,
        },
        session: {
          id: session?.id,
          title: session?.title,
          project_name: (session?.project as any)?.project_name ?? null,
          status: session?.status,
        },
        assignments: (assignments ?? []).map((a: any) => ({
          id: a.id,
          status: a.status,
          item: a.item,
          response: Array.isArray(a.response) ? a.response[0] ?? null : a.response,
        })),
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
