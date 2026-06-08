import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'

const resend = new Resend(process.env.RESEND_API_KEY)

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

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

    // Calculate week end
    const wkEnd = new Date(weekStart + 'T12:00:00')
    wkEnd.setDate(wkEnd.getDate() + 6)

    // Fetch punches for the week
    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, name, color, role')
      .eq('portal_account_id', account.id)

    const { data: punches } = await supabaseAdmin
      .from('elec_time_punches')
      .select('*, job:elec_job_cards(id, job_number, title)')
      .eq('portal_account_id', account.id)
      .gte('punched_at', weekStart + 'T00:00:00')
      .lte('punched_at', wkEnd.toISOString().split('T')[0] + 'T23:59:59')
      .order('punched_at')

    const staffMap = Object.fromEntries((staff ?? []).map(s => [s.id, s]))

    // Group punches by staff
    const byStaff: Record<string, typeof punches> = {}
    for (const p of punches ?? []) {
      if (!byStaff[p.staff_id]) byStaff[p.staff_id] = []
      byStaff[p.staff_id]!.push(p)
    }

    // Build HTML table rows
    const staffRows = Object.entries(byStaff).map(([staffId, staffPunches]) => {
      const member = staffMap[staffId]
      if (!staffPunches) return ''
      const ins = staffPunches.filter(p => p.punch_type === 'clock_in').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
      const outs = staffPunches.filter(p => p.punch_type === 'clock_out').sort((a, b) => a.punched_at.localeCompare(b.punched_at))
      let totalMs = 0
      const sessions = ins.map((inP, idx) => {
        const outP = outs[idx] ?? null
        const durMs = outP ? new Date(outP.punched_at).getTime() - new Date(inP.punched_at).getTime() : null
        if (durMs) totalMs += durMs
        return { in: inP, out: outP, durMs }
      })

      const totalH = Math.floor(totalMs / 3600000)
      const totalM = Math.floor((totalMs % 3600000) / 60000)

      const rows = sessions.map(ses => {
        const job = ses.in.job && !Array.isArray(ses.in.job) ? ses.in.job : null
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;">${fmtDate(ses.in.punched_at)}</td>
          <td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;">${fmtTime(ses.in.punched_at)}</td>
          <td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;">${ses.out ? fmtTime(ses.out.punched_at) : '<span style="color:#16a34a">On site</span>'}</td>
          <td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;font-weight:600;">${ses.durMs != null ? fmtDuration(ses.durMs) : '—'}</td>
          <td style="padding:6px 10px;border:1px solid #e4e4e7;font-size:12px;color:#71717a;">${job ? `${job.job_number} · ${job.title}` : '—'}</td>
        </tr>`
      }).join('')

      return `<div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${member?.color ?? '#3a7ca5'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:10px;">
            ${(member?.name ?? '??').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;">${member?.name ?? 'Unknown'}</div>
            <div style="font-size:11px;color:#71717a;">Total: ${totalMs > 0 ? `${totalH}h ${totalM}m` : '—'} · ${sessions.length} session${sessions.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">
          <thead>
            <tr style="background:#f0f2f5;">
              <th style="padding:5px 10px;border:1px solid #e4e4e7;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
              <th style="padding:5px 10px;border:1px solid #e4e4e7;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Clock In</th>
              <th style="padding:5px 10px;border:1px solid #e4e4e7;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Clock Out</th>
              <th style="padding:5px 10px;border:1px solid #e4e4e7;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Duration</th>
              <th style="padding:5px 10px;border:1px solid #e4e4e7;font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Job</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    }).join('')

    const companyName = account.company_name ?? account.email ?? 'Company'

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#18181b;padding:24px;max-width:700px;margin:0 auto;">
  <div style="border-bottom:2px solid #1e2a38;margin-bottom:20px;padding-bottom:14px;">
    <h1 style="font-size:18px;font-weight:700;color:#1e2a38;margin:0;">${companyName} — Weekly Timesheet</h1>
    <p style="font-size:12px;color:#71717a;margin:4px 0 0;">${periodLabel}</p>
  </div>
  ${message ? `<p style="background:#f0f8ff;border-left:3px solid #3a7ca5;padding:10px 14px;border-radius:4px;font-size:13px;margin-bottom:20px;">${message}</p>` : ''}
  ${staffRows.length > 0 ? staffRows : '<p style="color:#71717a;text-align:center;padding:30px;">No time records for this week.</p>'}
  <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:24px;">Generated by QuotingHub · quotinghub.co.za</p>
</body>
</html>`

    await resend.emails.send({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      to,
      subject: `Timesheet: ${periodLabel} — ${companyName}`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
