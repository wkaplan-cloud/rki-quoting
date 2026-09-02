import { NextRequest, NextResponse } from 'next/server'
import { todaySA } from '@/lib/dates'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'


export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await req.json() as { action: 'approve' | 'reject'; notes?: string }

    const { data: vo } = await supabaseAdmin
      .from('elec_variation_orders')
      .select('id, status, vo_number, description, value, quote:elec_quotes(id, project_name, portal_account_id)')
      .eq('share_token', token)
      .single()

    if (!vo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (vo.status !== 'pending') {
      return NextResponse.json({ error: 'VO is no longer pending' }, { status: 409 })
    }

    const quote = Array.isArray(vo.quote) ? vo.quote[0] : vo.quote

    if (body.action === 'approve') {
      await supabaseAdmin
        .from('elec_variation_orders')
        .update({ status: 'approved', approved_date: todaySA() })
        .eq('id', vo.id)
    } else {
      await supabaseAdmin
        .from('elec_variation_orders')
        .update({ status: 'rejected', rejection_notes: body.notes?.trim() ?? null })
        .eq('id', vo.id)
    }

    // Notify electrician
    if (quote?.portal_account_id) {
      const { data: account } = await supabaseAdmin
        .from('supplier_portal_accounts')
        .select('email, company_name')
        .eq('id', quote.portal_account_id)
        .maybeSingle()

      if (account?.email) {
        const isApproval = body.action === 'approve'
        const subject = isApproval
          ? `VO Approved — ${vo.vo_number} · ${quote.project_name}`
          : `VO Rejected — ${vo.vo_number} · ${quote.project_name}`

        sendEmail({
          from: 'QuotingHub Notifications <noreply@quotinghub.co.za>',
          replyTo: 'hello@quotinghub.co.za',
          to: account.email,
          subject,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">
  <div style="background:${isApproval ? '#166534' : '#7F1D1D'};padding:28px 32px;">
    <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Variation Order ${isApproval ? 'Approved' : 'Rejected'}</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${quote.project_name}</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#3F3F46;">
      ${isApproval
        ? `Your variation order <strong>${vo.vo_number}</strong> has been <strong style="color:#166534;">approved</strong>.`
        : `Your variation order <strong>${vo.vo_number}</strong> has been <strong style="color:#DC2626;">rejected</strong>.`
      }
    </p>
    <div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#18181B;">${vo.description}</p>
    </div>
    ${!isApproval && body.notes ? `<div style="background:#FEF2F2;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #FECACA;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#DC2626;">Reason</p><p style="margin:0;font-size:13px;color:#18181B;">${body.notes}</p></div>` : ''}
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}"
      style="display:inline-block;background:${isApproval ? '#166534' : '#3A7CA5'};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;">
      View Project →
    </a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
          text: isApproval
            ? `VO ${vo.vo_number} for ${quote.project_name} has been approved. View the project: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}`
            : `VO ${vo.vo_number} for ${quote.project_name} has been rejected.${body.notes ? `\n\nReason: ${body.notes}` : ''}\n\nView the project: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/quotes/${quote.id}`,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
