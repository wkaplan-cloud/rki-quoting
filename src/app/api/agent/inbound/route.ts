import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchReceived, inboundDomain, resend, tokenFrom } from '@/lib/agent/inbound'
import { fileInbound } from '@/lib/agent/process'
import { agentEnabled } from '@/lib/agent/gate'

// Resend's email.received webhook for the studio assistant. Public (see
// proxy.ts), so every request must carry a valid Resend signature.
//
// The message and its attachments are fetched before answering, so a failed
// fetch returns an error and Resend retries it. Reading it with Claude takes
// longer than a webhook should wait, so that part runs after the response;
// it stores its own errors on the email row.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const domain = inboundDomain()
  if (!secret || !domain) return NextResponse.json({ error: 'Inbound mail is not configured' }, { status: 500 })

  const payload = await req.text()
  let event: { type: string; data: Record<string, unknown> }
  try {
    event = resend().webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    }) as unknown as { type: string; data: Record<string, unknown> }
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  if (event.type !== 'email.received') return NextResponse.json({ ok: true, ignored: event.type })

  const emailId = typeof event.data.email_id === 'string' ? event.data.email_id : null
  if (!emailId) return NextResponse.json({ error: 'No email_id' }, { status: 400 })

  // Fetch first: the address that identifies the studio may only be in the
  // forwarding headers, which the webhook doesn't carry. A failed fetch
  // returns an error so Resend retries.
  let email
  try {
    email = await fetchReceived(emailId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }

  const token = tokenFrom(email.recipients, domain)
  if (!token) return NextResponse.json({ ok: true, ignored: 'no assistant address' })

  const { data: mailbox } = await supabaseAdmin.from('agent_mailboxes').select('org_id').eq('inbound_token', token).maybeSingle()
  if (!mailbox) return NextResponse.json({ ok: true, ignored: 'unknown assistant address' })
  if (!(await agentEnabled(mailbox.org_id))) return NextResponse.json({ ok: true, ignored: 'assistant switched off' })

  after(async () => {
    try {
      await fileInbound(mailbox.org_id, email)
    } catch (e) {
      await supabaseAdmin.from('agent_mailboxes')
        .update({ last_error: e instanceof Error ? e.message : String(e), updated_at: new Date().toISOString() })
        .eq('org_id', mailbox.org_id)
    }
  })
  return NextResponse.json({ ok: true })
}
