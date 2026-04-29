import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const { error } = await supabase.from('price_list_access').insert({
    org_id: orgId,
    price_list_id: id,
    status: 'pending',
  })

  if (error && error.code === '23505') {
    return NextResponse.json({ error: 'Already requested' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify platform admin of new request
  try {
    const [{ data: org }, { data: priceList }] = await Promise.all([
      supabaseAdmin.from('organizations').select('name').eq('id', orgId).single(),
      supabaseAdmin.from('price_lists').select('name, supplier_name').eq('id', id).single(),
    ])
    const resend = new Resend(process.env.RESEND_API_KEY)
    const subject = `New price list access request — ${priceList?.name ?? id}`
    await resend.emails.send({
      from: 'QuotingHub <no-reply@quotinghub.co.za>',
      to: 'hello@quotinghub.co.za',
      subject,
      text: `${org?.name ?? orgId} has requested access to the ${priceList?.name ?? id} price list (${priceList?.supplier_name ?? ''}).\n\nReview and approve at: https://quotinghub.co.za/platform/price-lists`,
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
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Price List Access Request</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;"><strong>${org?.name ?? orgId}</strong> has requested access to the <strong>${priceList?.name ?? id}</strong> price list${priceList?.supplier_name ? ` (${priceList.supplier_name})` : ''}.</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#2C2C2A;">Review the request and approve or reject it in the platform admin.</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="https://quotinghub.co.za/platform/price-lists" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">Review Request</a>
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
  } catch { /* non-critical — don't fail the request */ }

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
