import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import fs from 'fs'
import path from 'path'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params

    const { data: existing } = await supabaseAdmin
      .from('platform_welcome_emails')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Welcome email already sent' }, { status: 409 })
    }

    const { data: admin } = await supabaseAdmin
      .from('org_members')
      .select('invited_email, full_name')
      .eq('org_id', orgId)
      .eq('role', 'admin')
      .order('status', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!admin?.invited_email) {
      return NextResponse.json({ error: 'No admin email found for this studio' }, { status: 400 })
    }

    const html = fs.readFileSync(path.join(process.cwd(), 'designer-welcome-email.html'), 'utf-8')

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: resendError } = await resend.emails.send({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to: admin.invited_email,
      subject: 'Getting Started with QuotingHub',
      html,
    })

    if (resendError) {
      return NextResponse.json({ error: resendError.message }, { status: 500 })
    }

    await supabaseAdmin.from('platform_welcome_emails').insert({
      org_id: orgId,
      sent_to: admin.invited_email,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
