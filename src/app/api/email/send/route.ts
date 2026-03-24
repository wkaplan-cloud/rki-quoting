import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { projectId, type, overrideEmail } = await req.json() as { projectId: string; type: 'quote' | 'invoice'; overrideEmail?: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('*').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Use override email from modal, or fall back to what's saved on the client
  const clientEmail = overrideEmail?.trim() || (project.client as any)?.email
  if (!clientEmail) return NextResponse.json({ error: 'Client email not set' }, { status: 400 })

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(QuotePDF, {
      project,
      client: project.client ?? null,
      lineItems: lineItems ?? [],
      type,
      footerText: settings?.footer_text,
    }) as any
  )

  const label = type === 'quote' ? 'Quotation' : 'Invoice'
  const subject = `${label} - ${project.project_name} - ${project.project_number}`
  const studioName = settings?.business_name ?? 'Your Studio'
  const studioReplyTo = settings?.email_from

  await resend.emails.send({
    from: `${studioName} via QuotingHub <quotes@quotinghub.co.za>`,
    ...(studioReplyTo ? { replyTo: studioReplyTo } : {}),
    to: clientEmail,
    subject,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2C2C2A;">
        <h2 style="font-size: 24px; margin-bottom: 8px;">${studioName}</h2>
        <hr style="border: none; border-top: 1px solid #D8D3C8; margin: 24px 0;" />
        <p>Dear ${project.client?.client_name ?? 'Client'},</p>
        <p>Please find attached your ${label.toLowerCase()} for <strong>${project.project_name}</strong>.</p>
        <p>Reference: <strong>${project.project_number}</strong></p>
        <hr style="border: none; border-top: 1px solid #D8D3C8; margin: 24px 0;" />
        <p style="color: #8A877F; font-size: 12px;">${studioName}${studioReplyTo ? ` · ${studioReplyTo}` : ''}</p>
        <p style="color: #C4BFB5; font-size: 11px; margin-top: 4px;">Sent via QuotingHub · quotinghub.co.za</p>
      </div>
    `,
    attachments: [{
      filename: `${project.project_number}-${type}.pdf`,
      content: Buffer.from(buffer),
    }],
  })

  return NextResponse.json({ success: true })
}
