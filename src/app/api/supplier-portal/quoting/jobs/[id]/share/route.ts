import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { data: job } = await supabaseAdmin
      .from('elec_jobs')
      .select('id, share_token')
      .eq('id', jobId)
      .eq('portal_account_id', account.id)
      .single()
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    let token = job.share_token as string | null
    if (!token) {
      token = crypto.randomUUID()
      await supabaseAdmin
        .from('elec_jobs')
        .update({ share_token: token, share_token_created_at: new Date().toISOString() })
        .eq('id', jobId)
    }

    return NextResponse.json({ token })
  } catch (e) {
    return apiError(e)
  }
}
