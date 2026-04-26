import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/supplier-portal/requests — list all sourcing sessions for this supplier account
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!account) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id, supplier_name, email, status, sent_at, token, session:sourcing_sessions(id, title, status, user_id, project:projects(project_name))')
      .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fetch studio names per user_id
    const userIds = [...new Set(
      (data ?? []).map((ss: any) => {
        const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
        return session?.user_id as string | undefined
      }).filter(Boolean)
    )]

    const studioMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: settingsRows } = await supabaseAdmin
        .from('settings').select('user_id, business_name').in('user_id', userIds)
      for (const s of settingsRows ?? []) {
        if (s.user_id) studioMap[s.user_id] = s.business_name ?? 'Studio'
      }
    }

    const result = (data ?? []).map((ss: any) => {
      const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
      return {
        id: ss.id,
        supplier_name: ss.supplier_name,
        status: ss.status,
        sent_at: ss.sent_at,
        token: ss.token,
        session: session ? {
          id: session.id,
          title: session.title,
          status: session.status,
          project_name: (session.project as any)?.project_name ?? null,
        } : null,
        studio_name: session?.user_id ? (studioMap[session.user_id] ?? 'Studio') : 'Studio',
      }
    })

    return NextResponse.json({ data: result })
  } catch (e) {
    return apiError(e)
  }
}
