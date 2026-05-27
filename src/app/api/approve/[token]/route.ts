import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

// POST /api/approve/[token]
// Public — no auth. Client submits their decision + optional comment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const { decision, comment, client_name, client_email } = await req.json() as {
      decision: 'approved' | 'declined'
      comment?: string
      client_name?: string
      client_email?: string
    }

    if (decision !== 'approved' && decision !== 'declined') {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    // Look up the approval record by token
    const { data: approval } = await supabaseAdmin
      .from('quote_approvals')
      .select('id, project_id, submitted_at')
      .eq('token', token)
      .maybeSingle()

    if (!approval) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    if (approval.submitted_at) return NextResponse.json({ error: 'already_submitted' }, { status: 409 })

    const now = new Date().toISOString()

    // Save the decision
    await supabaseAdmin
      .from('quote_approvals')
      .update({ decision, comment: comment?.trim() || null, submitted_at: now, client_name: client_name || null, client_email: client_email || null })
      .eq('id', approval.id)

    // If approved, tick the stage
    if (decision === 'approved') {
      await supabaseAdmin
        .from('project_stages')
        .upsert(
          { project_id: approval.project_id, client_approved: true, client_approved_at: now },
          { onConflict: 'project_id' }
        )
    }

    // Fetch project + settings to notify the designer
    const [{ data: project }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('projects').select('project_name, project_number, user_id').eq('id', approval.project_id).single(),
      supabaseAdmin.from('settings').select('business_name, email_from').eq('user_id',
        (await supabaseAdmin.from('projects').select('user_id').eq('id', approval.project_id).single()).data?.user_id ?? ''
      ).maybeSingle(),
    ])

    if (project) {
      // Get the designer's auth email as fallback
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(project.user_id)
      const notifyEmail = settings?.email_from?.trim() || authUser?.user?.email
      const studioName = settings?.business_name ?? 'Your studio'

      if (notifyEmail) {
        const decisionLabel = decision === 'approved' ? 'approved' : 'declined'
        const subject = `Client ${decisionLabel} quote ${project.project_number} – ${project.project_name}`

        await resend.emails.send({
          from: `QuotingHub <notifications@quotinghub.co.za>`,
          to: notifyEmail,
          subject,
          html: buildNotificationEmail({ decision, comment, clientName: client_name, projectName: project.project_name, projectNumber: project.project_number, studioName }),
          text: `Your client has ${decisionLabel} the quote for ${project.project_name} (${project.project_number}).${comment ? `\n\nClient comment: ${comment}` : ''}`,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[approve]', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// GET /api/approve/[token] — public fetch for the approval page
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: approval } = await supabaseAdmin
      .from('quote_approvals')
      .select('id, project_id, submitted_at, decision')
      .eq('token', token)
      .maybeSingle()

    if (!approval) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

    const [{ data: project }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('projects').select('project_name, project_number, user_id, client:clients(client_name)').eq('id', approval.project_id).single(),
      supabaseAdmin.from('settings').select('business_name, logo_url').eq('user_id',
        (await supabaseAdmin.from('projects').select('user_id').eq('id', approval.project_id).single()).data?.user_id ?? ''
      ).maybeSingle(),
    ])

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const client = Array.isArray(project.client) ? project.client[0] : project.client

    return NextResponse.json({
      project_name: project.project_name,
      project_number: project.project_number,
      client_name: (client as { client_name?: string } | null)?.client_name ?? null,
      business_name: settings?.business_name ?? null,
      logo_url: settings?.logo_url ?? null,
      already_submitted: !!approval.submitted_at,
      decision: approval.decision ?? null,
    })
  } catch (e) {
    console.error('[approve GET]', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

function buildNotificationEmail({ decision, comment, clientName, projectName, projectNumber, studioName }: {
  decision: 'approved' | 'declined'
  comment?: string | null
  clientName?: string | null
  projectName: string
  projectNumber: string
  studioName: string
}) {
  const isApproved = decision === 'approved'
  const accentColor = isApproved ? '#16A34A' : '#C4A46B'
  const decisionLabel = isApproved ? 'Approved' : 'Declined'
  const from = clientName ? `${clientName}` : 'Your client'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <tr>
          <td style="background-color:#4A4A47;padding:28px 36px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:20px;font-weight:600;color:#F5F2EC;">${studioName}</p>
            <p style="margin:5px 0 0;font-size:11px;color:${accentColor};letter-spacing:0.08em;text-transform:uppercase;">Quote ${decisionLabel}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:36px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              ${from} has <strong style="color:${accentColor};">${decision}</strong> the quote for <strong>${projectName}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #EDE9E1;border-left:3px solid ${accentColor};border-radius:4px;margin-bottom:20px;">
              <tr><td style="padding:12px 16px;">
                <p style="margin:0;font-size:10px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Reference</p>
                <p style="margin:3px 0 0;font-size:15px;font-weight:600;color:#1A1A18;">${projectNumber}</p>
              </td></tr>
            </table>
            ${comment ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-radius:6px;margin-bottom:20px;">
              <tr><td style="padding:14px 16px;">
                <p style="margin:0;font-size:10px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Client comment</p>
                <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#2C2C2A;">${comment}</p>
              </td></tr>
            </table>` : ''}
            <p style="margin:0;font-size:13px;color:#8A877F;">Log in to QuotingHub to view the project and take next steps.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
