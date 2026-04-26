import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/supplier-portal/requests/[recipientId]
// recipientId is a session_supplier id — returns token to redirect to public respond page
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const { recipientId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('email')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!account) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id, token, email')
      .eq('id', recipientId)
      .maybeSingle()

    if (!ss || (ss.email as string).toLowerCase() !== account.email.toLowerCase()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ token: ss.token })
  } catch (e) {
    return apiError(e)
  }
}
