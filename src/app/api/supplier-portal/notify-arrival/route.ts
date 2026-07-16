import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

// POST /api/supplier-portal/notify-arrival — supplier notifies studio that fabric/item is ready
export async function POST(req: NextRequest) {
  try {
  // session_supplier_id passed as recipientId for backwards compat
  const { recipientId, notes } = await req.json() as { recipientId: string; notes?: string }
  if (!recipientId) return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email, company_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const { data: ss } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, email, session:sourcing_sessions(id, title, org_id, user_id)')
    .eq('id', recipientId)
    .maybeSingle()

  if (!ss || (ss.email as string).toLowerCase() !== portalAccount.email.toLowerCase()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const session = Array.isArray(ss.session) ? ss.session[0] : ss.session as { id: string; title: string; org_id: string; user_id: string } | null
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('email_from, business_name')
    .eq('org_id', session.org_id)
    .maybeSingle()

  const studioEmail = settings?.email_from
  if (!studioEmail) return NextResponse.json({ error: 'Studio email not configured' }, { status: 400 })

  const supplierDisplay = portalAccount.company_name || ss.supplier_name || 'Your supplier'
  const studioName = settings?.business_name || 'Studio'

  const subject = `Item Ready — ${session.title} (${supplierDisplay})`
  await resend.emails.send({
    from: `QuotingHub Notifications <noreply@quotinghub.co.za>`,
    replyTo: 'hello@quotinghub.co.za',
    to: studioEmail,
    subject,
    text: `Hi ${studioName},\n\n${supplierDisplay} has notified you that items from the following price request are ready:\n\n${session.title}\n\n${notes ? `Note from supplier: ${notes}\n\n` : ''}Please arrange collection or delivery at your earliest convenience.\n\nLog in at: https://quotinghub.co.za`,
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
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Sourcing Update</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Hi ${studioName},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;"><strong>${supplierDisplay}</strong> has notified you that items from the following price request are ready:</p>
            <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#1A1A18;">${session.title}</p>
            ${notes ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5C5C5A;font-style:italic;">Note from supplier: ${notes}</p>` : ''}
            <p style="margin:0;font-size:15px;line-height:1.7;color:#2C2C2A;">Please arrange collection or delivery at your earliest convenience.</p>
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

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
