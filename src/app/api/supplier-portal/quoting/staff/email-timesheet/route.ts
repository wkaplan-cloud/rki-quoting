import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { TimesheetPDF } from '@/lib/pdf/TimesheetPDF'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolvePortalAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 404 })

    const { to, message, weekStart, periodLabel } = await req.json() as {
      to: string; message?: string; weekStart: string; periodLabel: string
    }
    if (!to) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const wkEnd = new Date(weekStart + 'T12:00:00')
    wkEnd.setDate(wkEnd.getDate() + 6)

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, name, color')
      .eq('portal_account_id', account.id)

    const { data: punches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('*, job:elec_job_cards(id, job_number, title)')
      .eq('portal_account_id', account.id)
      .gte('punched_at', weekStart + 'T00:00:00')
      .lte('punched_at', wkEnd.toISOString().split('T')[0] + 'T23:59:59')
      .order('punched_at')

    // Group punches by staff
    const byStaff: Record<string, typeof punches> = {}
    for (const p of punches ?? []) {
      if (!byStaff[p.staff_id]) byStaff[p.staff_id] = []
      byStaff[p.staff_id]!.push(p)
    }

    // Build staff data for PDF
    const staffData = (staff ?? [])
      .filter(s => byStaff[s.id]?.length)
      .map(s => ({
        id: s.id,
        name: s.name,
        color: s.color ?? '#3A7CA5',
        punches: (byStaff[s.id] ?? []).map(p => ({
          punch_type: p.punch_type,
          punched_at: p.punched_at,
          job: p.job && !Array.isArray(p.job) ? p.job as { job_number: string; title: string } : null,
        })),
      }))

    const companyName = account.company_name ?? account.email ?? 'Company'

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(TimesheetPDF as any, { companyName, periodLabel, staffData }) as any)

    const safeFilename = `Timesheet_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

    await resend.emails.send({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to,
      subject: `Timesheet: ${periodLabel} — ${companyName}`,
      html: `<p>Please find the timesheet for <strong>${periodLabel}</strong> attached.</p>${message ? `<p>${message}</p>` : ''}<p style="color:#888;font-size:12px;">Sent via QuotingHub</p>`,
      attachments: [
        {
          filename: safeFilename,
          content: Buffer.from(buffer).toString('base64'),
        },
      ],
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
