import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email, contact_name, phone')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'QuotingHub <no-reply@quotinghub.co.za>',
    to: 'hello@quotinghub.co.za',
    subject: `Supplier Account Deletion Request — ${account.company_name ?? account.email}`,
    html: `
      <p>A supplier has requested their account be deleted.</p>
      <table>
        <tr><td><strong>Account ID</strong></td><td>${account.id}</td></tr>
        <tr><td><strong>Company</strong></td><td>${account.company_name ?? '—'}</td></tr>
        <tr><td><strong>Contact</strong></td><td>${account.contact_name ?? '—'}</td></tr>
        <tr><td><strong>Email</strong></td><td>${account.email}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${account.phone ?? '—'}</td></tr>
      </table>
      <p>To delete this account, call:<br>
      <code>DELETE /api/admin/suppliers/${account.id}</code></p>
    `,
    text: `Supplier account deletion request\n\nAccount ID: ${account.id}\nCompany: ${account.company_name ?? '—'}\nContact: ${account.contact_name ?? '—'}\nEmail: ${account.email}\nPhone: ${account.phone ?? '—'}\n\nDelete via: DELETE /api/admin/suppliers/${account.id}`,
  })

  if (error) return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  return NextResponse.json({ success: true })
}
