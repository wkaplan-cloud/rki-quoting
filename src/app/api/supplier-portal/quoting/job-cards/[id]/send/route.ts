import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { sendJobCardEmail } from '@/lib/job-card-email'

export const maxDuration = 60

async function resolveAccount(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('auth_user_id', userId).maybeSingle()
  if (own) return own
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (!mem) return null
  const { data: acc } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('id', mem.portal_account_id).maybeSingle()
  return acc
}

// Staff send the completed job card to the client as proof of work
async function resolveAccountOrStaff(userId: string) {
  const own = await resolveAccount(userId)
  if (own) return own
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (!staff) return null
  const { data: acc } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('id', staff.portal_account_id).maybeSingle()
  return acc
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { email, name, message, as_invoice, include_link, client_company, client_qs_name, client_qs_email } = await req.json() as { email: string; name?: string; message?: string; as_invoice?: boolean; include_link?: boolean; client_company?: string | null; client_qs_name?: string | null; client_qs_email?: string | null }
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolveAccountOrStaff(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const result = await sendJobCardEmail({
      account,
      jobCardId: id,
      email,
      name,
      message,
      asInvoice: as_invoice ?? false,
      includeLink: include_link ?? false,
      clientCompany: client_company,
      clientQsName: client_qs_name,
      clientQsEmail: client_qs_email,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
