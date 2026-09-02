import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

async function assertPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    throw new Error('Forbidden')
  }
}

async function sendInviteEmail(
  to: string,
  name: string | null,
  companyName: string,
  replyTo: string,
  token: string,
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
  const inviteUrl = `${baseUrl}/supplier-portal/accept-admin-invite?token=${token}`

  await sendEmail({
    from: `${companyName} via QuotingHub <noreply@quotinghub.co.za>`,
    replyTo,
    to,
    subject: `You've been invited to manage ${companyName} on QuotingHub`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;">
      <tr><td style="background:#1E2A38;padding:28px 36px;border-radius:8px 8px 0 0;">
        <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${companyName}</p>
        <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.08em;">Admin Invitation</p>
      </td></tr>
      <tr><td style="background:#fff;padding:36px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#18181B;">Hi${name ? ` ${name}` : ''},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#18181B;">You've been invited to manage <strong>${companyName}</strong> on QuotingHub as an admin.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#3A7CA5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:14px;">Accept Invitation →</a>
        <p style="margin:20px 0 0;font-size:12px;color:#71717A;">Or copy this link: ${inviteUrl}</p>
      </td></tr>
      <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
        <p style="margin:0;font-size:11px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;">QuotingHub</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    text: `Hi${name ? ` ${name}` : ''},\n\nYou've been invited to manage ${companyName} on QuotingHub.\n\nAccept: ${inviteUrl}`,
  })
}

// POST — resend existing invite OR create new invite
export async function POST(req: NextRequest) {
  try {
    await assertPlatformAdmin()

    const body = await req.json() as {
      memberId: string
      accountId: string
      newEmail?: string
      newName?: string
    }
    const { memberId, accountId, newEmail, newName } = body

    const { data: account } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('company_name, email')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const companyName = account.company_name ?? 'Your organisation'

    // ── New invite ──────────────────────────────────────────────────────
    if (memberId === '__new__') {
      if (!newEmail?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

      const token = crypto.randomBytes(32).toString('hex')
      const now = new Date().toISOString()

      const { data: upserted, error } = await supabaseAdmin
        .from('portal_org_members')
        .upsert({
          portal_account_id: accountId,
          email: newEmail.toLowerCase().trim(),
          name: newName ?? null,
          role: 'admin',
          invite_token: token,
          invited_at: now,
        }, { onConflict: 'portal_account_id,email' })
        .select('id, email, name, invited_at, accepted_at')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await sendInviteEmail(newEmail, newName ?? null, companyName, account.email, token)

      return NextResponse.json({ ok: true, member: upserted })
    }

    // ── Resend existing invite ──────────────────────────────────────────
    const { data: member } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, email, name, accepted_at')
      .eq('id', memberId)
      .eq('portal_account_id', accountId)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (member.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })

    const token = crypto.randomBytes(32).toString('hex')
    await supabaseAdmin
      .from('portal_org_members')
      .update({ invite_token: token, invited_at: new Date().toISOString() })
      .eq('id', memberId)

    await sendInviteEmail(member.email, member.name, companyName, account.email, token)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE — remove admin user
export async function DELETE(req: NextRequest) {
  try {
    await assertPlatformAdmin()

    const { memberId } = await req.json() as { memberId: string }
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

    const { data: member } = await supabaseAdmin
      .from('portal_org_members')
      .select('id, auth_user_id')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    await supabaseAdmin.from('portal_org_members').delete().eq('id', memberId)

    if (member.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(member.auth_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
