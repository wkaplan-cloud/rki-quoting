import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { orgId, action } = await req.json() as { orgId: string; action: 'active' | 'rejected' }

  const { error } = await supabaseAdmin
    .from('price_list_access')
    .update({ status: action, approved_at: action === 'active' ? new Date().toISOString() : null })
    .eq('org_id', orgId)
    .eq('price_list_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved, email the org's admin users
  if (action === 'active') {
    try {
      const [{ data: priceList }, { data: orgMembers }] = await Promise.all([
        supabaseAdmin.from('price_lists').select('name, supplier_name').eq('id', id).single(),
        supabaseAdmin.from('org_members').select('invited_email').eq('org_id', orgId).eq('role', 'admin').eq('status', 'active'),
      ])
      const adminEmails = (orgMembers ?? []).map(m => m.invited_email).filter(Boolean)
      if (adminEmails.length > 0 && priceList) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'QuotingHub <no-reply@quotinghub.co.za>',
          to: adminEmails,
          subject: `Price list access approved — ${priceList.name}`,
          text: `Your request to access the ${priceList.name} price list (${priceList.supplier_name}) has been approved.\n\nYou can now search and retrieve prices from this supplier when creating quotes.\n\nLog in at: https://quotinghub.co.za`,
        })
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
