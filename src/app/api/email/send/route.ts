import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { projectId, type } = await req.json() as { projectId: string; type: 'quote' | 'invoice' }

  const supabase = await createClient()
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('*').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (!project.client?.email && !(project.client as any)?.contact_number) {
    return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })
  }

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
  const fromEmail = settings?.email_from ?? 'quotes@rkaplaninteriors.co.za'

  // Get client email — stored on client record if available
  const clientEmail = (project.client as any)?.email
  if (!clientEmail) return NextResponse.json({ error: 'Client email not set' }, { status: 400 })

  await resend.emails.send({
    from: `R Kaplan Interiors <${fromEmail}>`,
    to: clientEmail,
    subject,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2C2C2A;">
        <h2 style="font-size: 24px; margin-bottom: 8px;">R Kaplan Interiors</h2>
        <p style="color: #9A7B4F; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 0;">Interior Design</p>
        <hr style="border: none; border-top: 1px solid #D8D3C8; margin: 24px 0;" />
        <p>Dear ${project.client?.client_name ?? 'Client'},</p>
        <p>Please find attached your ${label.toLowerCase()} for <strong>${project.project_name}</strong>.</p>
        <p>Reference: <strong>${project.project_number}</strong></p>
        <hr style="border: none; border-top: 1px solid #D8D3C8; margin: 24px 0;" />
        <p style="color: #8A877F; font-size: 12px;">R Kaplan Interiors · quotes@rkaplaninteriors.co.za</p>
      </div>
    `,
    attachments: [{
      filename: `${project.project_number}-${type}.pdf`,
      content: Buffer.from(buffer),
    }],
  })

  return NextResponse.json({ success: true })
}
