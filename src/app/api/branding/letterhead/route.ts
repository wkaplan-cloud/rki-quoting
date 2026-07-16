import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, filename } = await req.json() as { url: string; filename: string }
    if (!url || !filename) return NextResponse.json({ error: 'url and filename are required' }, { status: 400 })

    // Save letterhead_url to this studio's settings row (RLS-filtered by org)
    const { data: settings } = await supabase
      .from('settings')
      .select('id, business_name, email_from')
      .maybeSingle()

    if (settings?.id) {
      await supabase
        .from('settings')
        .update({ letterhead_url: url, letterhead_filename: filename })
        .eq('id', settings.id)
    }

    const studioName = settings?.business_name ?? user.email ?? 'Unknown studio'
    const studioEmail = settings?.email_from ?? user.email ?? ''
    const notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL

    if (notifyEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'QuotingHub <noreply@quotinghub.co.za>',
        replyTo: 'hello@quotinghub.co.za',
        to: notifyEmail,
        subject: `[QuotingHub] Letterhead uploaded — ${studioName}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F5F2EC;border-radius:8px;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#1A1A18;">Letterhead uploaded</h2>
            <p style="margin:4px 0 0;font-size:14px;color:#8A877F;">A studio on the Agency plan has uploaded a letterhead for custom PDF branding.</p>
            <hr style="border:none;border-top:1px solid #D8D3C8;margin:16px 0;" />
            <p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong style="color:#1A1A18;">Studio:</strong> ${esc(studioName)}</p>
            ${studioEmail ? `<p style="margin:0 0 8px;font-size:14px;color:#8A877F;"><strong style="color:#1A1A18;">Email:</strong> ${esc(studioEmail)}</p>` : ''}
            <p style="margin:0 0 16px;font-size:14px;color:#8A877F;"><strong style="color:#1A1A18;">Filename:</strong> <span style="font-family:monospace;background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #D8D3C8;">${esc(filename)}</span></p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
              <tr>
                <td style="background:#1A1A18;border-radius:6px;padding:10px 20px;">
                  <a href="${url}" target="_blank" style="color:#F5F2EC;text-decoration:none;font-size:13px;font-weight:500;font-family:sans-serif;">View uploaded file &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:11px;color:#8A877F;word-break:break-all;">Direct URL: ${esc(url)}</p>
            <hr style="border:none;border-top:1px solid #D8D3C8;margin:24px 0 16px;" />
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#9A7B4F;border-radius:6px;padding:10px 20px;">
                  <a href="https://quotinghub.co.za/platform/studios" target="_blank" style="color:#fff;text-decoration:none;font-size:13px;font-weight:500;font-family:sans-serif;">View studio in platform &rarr;</a>
                </td>
              </tr>
            </table>
          </div>
        `,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
