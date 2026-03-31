import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL
const REPLY_FROM = process.env.PLATFORM_REPLY_EMAIL ?? 'hello@quotinghub.co.za'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, toName, message, id } = await req.json() as { to: string; toName?: string; message: string; id?: string }
  if (!to || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const repliedAt = new Date().toISOString()
    await resend.emails.send({
      from: `QuotingHub <${REPLY_FROM}>`,
      to,
      replyTo: REPLY_FROM,
      subject: 'Re: your QuotingHub message',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F5F2EC;border-radius:8px;">
          <h2 style="margin:0 0 4px;font-size:18px;color:#1A1A18;">Message from QuotingHub</h2>
          <hr style="border:none;border-top:1px solid #D8D3C8;margin:16px 0;" />
          <p style="margin:0;font-size:15px;color:#1A1A18;white-space:pre-wrap;line-height:1.6;">${esc(message)}</p>
          <hr style="border:none;border-top:1px solid #D8D3C8;margin:24px 0 16px;" />
          <p style="margin:0;font-size:12px;color:#8A877F;">QuotingHub &middot; <a href="mailto:${REPLY_FROM}" style="color:#8A877F;">${REPLY_FROM}</a></p>
        </div>
      `,
    })
    if (id) await supabaseAdmin.from('contact_submissions').update({ replied_at: repliedAt }).eq('id', id)
    return NextResponse.json({ ok: true, replied_at: repliedAt })
  } catch {
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
