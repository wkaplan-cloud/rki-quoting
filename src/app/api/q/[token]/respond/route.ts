import { NextRequest, NextResponse } from 'next/server'
import { todaySA } from '@/lib/dates'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { createJobCardFromExtrasQuote } from '@/lib/job-card-extras'


export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await req.json() as { action: 'approve' | 'request_changes'; client_name?: string; notes?: string }

    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id, status, portal_account_id, quote_number, project_name, client:elec_clients(client_name)')
      .eq('share_token', token)
      .single()

    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['quoted', 'draft'].includes(quote.status)) {
      return NextResponse.json({ error: 'Quote is not in a state that can be approved' }, { status: 409 })
    }

    if (body.action === 'approve') {
      await supabaseAdmin
        .from('elec_quotes')
        .update({ status: 'in_progress', approved_date: todaySA() })
        .eq('id', quote.id)

      // Extra work found on a job card becomes its own job card once approved,
      // ready to schedule. No-op for every other kind of quote.
      const newCard = await createJobCardFromExtrasQuote(quote.id)
      if (newCard) {
        await supabaseAdmin.from('elec_notifications').insert({
          portal_account_id: quote.portal_account_id,
          type: 'extra_work_approved',
          title: `Extra work approved \u2014 ${quote.quote_number}`,
          body: `Job card ${newCard.job_number} created for ${quote.project_name}. It still needs scheduling.`,
          metadata: { job_card_id: newCard.id, quote_id: quote.id },
        })
      }
    }

    // Notify the electrician — fire and forget
    if (quote.portal_account_id) {
      const { data: account } = await supabaseAdmin
        .from('supplier_portal_accounts')
        .select('email, company_name')
        .eq('id', quote.portal_account_id)
        .maybeSingle()

      if (account?.email) {
        const clientRaw = Array.isArray(quote.client) ? quote.client[0] : quote.client
        const clientName = clientRaw?.client_name ?? 'Your client'
        const isApproval = body.action === 'approve'
        const subject = isApproval
          ? `Quote approved — ${quote.quote_number} · ${quote.project_name}`
          : `Changes requested — ${quote.quote_number} · ${quote.project_name}`

        sendEmail({
          from: 'QuotingHub Notifications <noreply@quotinghub.co.za>',
          replyTo: 'hello@quotinghub.co.za',
          to: account.email,
          subject,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">
  <div style="background:${isApproval ? '#166534' : '#1E2A38'};padding:28px 32px;">
    <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">${isApproval ? 'Quote Approved' : 'Changes Requested'}</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${quote.project_name}</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#3F3F46;">
      ${isApproval
        ? `<strong>${clientName}</strong> has <strong style="color:#166534;">approved</strong> quote <strong>${quote.quote_number}</strong>.`
        : `<strong>${clientName}</strong> has requested changes on quote <strong>${quote.quote_number}</strong>.`
      }
    </p>
    ${!isApproval && body.notes ? `<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin-bottom:16px;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#71717A;">Their notes</p><p style="margin:0;font-size:13px;color:#18181B;">${body.notes}</p></div>` : ''}
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}"
      style="display:inline-block;background:${isApproval ? '#166534' : '#3A7CA5'};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;">
      ${isApproval ? 'Start Project →' : 'View Quote →'}
    </a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
          text: isApproval
            ? `${clientName} has approved quote ${quote.quote_number} for ${quote.project_name}. Log in to start the project: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}`
            : `${clientName} has requested changes on quote ${quote.quote_number} for ${quote.project_name}.\n\n${body.notes ? `Their notes: ${body.notes}\n\n` : ''}View the quote: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}`,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
