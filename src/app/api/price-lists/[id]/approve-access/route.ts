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
        const subject = `Price list access approved — ${priceList.name}`
        await resend.emails.send({
          from: 'QuotingHub <no-reply@quotinghub.co.za>',
          to: adminEmails,
          subject,
          text: `Your request to access the ${priceList.name} price list (${priceList.supplier_name}) has been approved.\n\nYou can now search and retrieve prices from this supplier when creating quotes.\n\nLog in at: https://quotinghub.co.za`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">QuotingHub</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Price List Access</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Your request to access the <strong>${priceList.name}</strong> price list${priceList.supplier_name ? ` (${priceList.supplier_name})` : ''} has been approved.</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#2C2C2A;">You can now search and retrieve prices from this supplier when creating quotes.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="https://quotinghub.co.za" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Open QuotingHub</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">QuotingHub &middot; <a href="https://quotinghub.co.za" style="color:#8A877F;text-decoration:none;">quotinghub.co.za</a></p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Built for interior designers</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        })
      }
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
