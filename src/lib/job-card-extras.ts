import { supabaseAdmin } from './supabase/admin'
import { resolveAccountOrStaff } from './portal-account'
import { one, type Embedded } from './supabase/embed'
import { sendEmail } from './email'
import type { ElecJobCardExtra } from './elec-types'

export type JobCardExtrasSettings = {
  company_code: string | null
  quote_prefix: string | null
  default_vat_rate: number | null
  default_retention_percentage: number | null
  default_payment_terms_days: number | null
  default_defects_liability_days: number | null
  job_card_extras_enabled: boolean | null
} | null

export type ExtrasCard = {
  id: string
  job_number: string
  title: string
  location: string | null
  client_id: string | null
  staff_id: string | null
  additional_staff_ids: string[] | null
}

export type ExtrasContext = {
  accountId: string
  staffId: string | null
  staffName: string | null
  card: ExtrasCard
  settings: JobCardExtrasSettings
}

export type ExtrasResolution =
  | { ok: true; ctx: ExtrasContext }
  | { ok: false; status: number; error: string }

/**
 * Shared guard for the job-card extra-work routes.
 *
 * Owners and org members reach any job card on their account; a staff member
 * only reaches a card they are assigned to. Also carries the account's quote
 * defaults so the submit route doesn't re-query them.
 */
export async function resolveExtrasContext(userId: string, jobCardId: string): Promise<ExtrasResolution> {
  const resolved = await resolveAccountOrStaff(userId)
  if (!resolved) return { ok: false, status: 403, error: 'No account' }

  const [{ data: card }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, location, client_id, staff_id, additional_staff_ids')
      .eq('id', jobCardId)
      .eq('portal_account_id', resolved.accountId)
      .maybeSingle(),
    supabaseAdmin
      .from('elec_settings')
      .select('company_code, quote_prefix, default_vat_rate, default_retention_percentage, default_payment_terms_days, default_defects_liability_days, job_card_extras_enabled')
      .eq('portal_account_id', resolved.accountId)
      .maybeSingle(),
  ])

  if (!card) return { ok: false, status: 404, error: 'Not found' }

  if (resolved.staffId) {
    const assigned = card.staff_id === resolved.staffId
      || (card.additional_staff_ids ?? []).includes(resolved.staffId)
    if (!assigned) return { ok: false, status: 404, error: 'Not found' }
  }

  return {
    ok: true,
    ctx: {
      accountId: resolved.accountId,
      staffId: resolved.staffId,
      staffName: resolved.staffName,
      card: card as ExtrasCard,
      settings: settings as JobCardExtrasSettings,
    },
  }
}

/** The kill switch defaults on — only an explicit false turns the step off. */
export function extrasEnabled(settings: { job_card_extras_enabled?: boolean | null } | null): boolean {
  return settings?.job_card_extras_enabled !== false
}

type ExtraRow = Omit<ElecJobCardExtra, 'created_job_card'> & {
  created_job_card?: Embedded<NonNullable<ElecJobCardExtra['created_job_card']>>
}

/** Unwraps the embedded quote on each extra so callers get a plain object or null. */
export function normalizeExtras(rows: unknown): ElecJobCardExtra[] {
  return ((rows ?? []) as ExtraRow[]).map(r => ({ ...r, created_job_card: one(r.created_job_card) }))
}


/**
 * Tells the office a tech has sent through extra work the client asked for:
 * a bell notification and an email, because a card sitting unpriced is money
 * not being quoted.
 */
export async function notifyExtraWorkSubmitted(opts: {
  accountId: string
  sourceCard: { id: string; job_number: string; title: string }
  newCard: { id: string; job_number: string }
  items: { description: string; qty: number; unit: string | null; notes: string | null }[]
  reportedBy: string | null
  staffId: string | null
  note: string | null
}) {
  const { accountId, sourceCard, newCard, items, reportedBy, note } = opts
  const who = reportedBy ?? 'Staff'
  const countLabel = `${items.length} item${items.length === 1 ? '' : 's'}`

  await supabaseAdmin.from('elec_notifications').insert({
    portal_account_id: accountId,
    type: 'extra_work',
    title: `Extra work — ${who}`,
    body: `${countLabel} off ${sourceCard.job_number}. Job card ${newCard.job_number} is waiting to be priced.`,
    metadata: { job_card_id: newCard.id, source_job_card_id: sourceCard.id, staff_id: opts.staffId },
  })

  const [{ data: account }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from('supplier_portal_accounts')
      .select('email, company_name')
      .eq('id', accountId)
      .maybeSingle(),
    supabaseAdmin
      .from('portal_org_members')
      .select('email')
      .eq('portal_account_id', accountId)
      .not('accepted_at', 'is', null),
  ])
  if (!account?.email) return

  const cc = (members ?? [])
    .map(m => m.email as string | null)
    .filter((e): e is string => !!e && e.toLowerCase() !== account.email.toLowerCase())

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
  const cardUrl = `${appUrl}/supplier-portal/quoting/job-cards/${newCard.id}`
  const rows = items.map(i => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#18181B;border-bottom:1px solid #F4F4F5;">${i.description}${i.notes ? ` <span style="color:#71717A;">(${i.notes})</span>` : ''}</td>
      <td style="padding:6px 0;font-size:13px;color:#71717A;text-align:right;white-space:nowrap;border-bottom:1px solid #F4F4F5;">${i.qty} ${i.unit ?? 'nr'}</td>
    </tr>`).join('')

  await sendEmail({
    to: account.email,
    ...(cc.length ? { cc } : {}),
    subject: `Extra work to price — ${newCard.job_number} (off ${sourceCard.job_number})`,
    preheader: `${who} sent through ${countLabel} the client asked for.`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4E4E7;">
  <div style="background:#8A6A1F;padding:28px 32px;">
    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Extra Work</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${newCard.job_number} — needs pricing</h1>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 16px;font-size:14px;color:#3F3F46;">
      <strong>${who}</strong> sent through ${countLabel} the client asked for while on
      <strong>${sourceCard.job_number}</strong> — ${sourceCard.title}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">${rows}</table>
    ${note ? `<div style="background:#F4F4F5;border-radius:8px;padding:12px 16px;margin-bottom:18px;"><p style="margin:0;font-size:13px;color:#18181B;">${note}</p></div>` : ''}
    <p style="margin:0 0 20px;font-size:13px;color:#71717A;">
      Job card ${newCard.job_number} has been created with these on its job sheet, unpriced. Price it, then send it to the client to approve.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#8A6A1F;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;">Price ${newCard.job_number} →</a>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;font-size:11px;color:#A1A1AA;">Sent via <a href="https://quotinghub.co.za" style="color:#3A7CA5;text-decoration:none;">QuotingHub</a></p>
  </div>
</div>
</body></html>`,
    text: `Extra work to price — ${newCard.job_number}\n\n${who} sent through ${countLabel} the client asked for while on ${sourceCard.job_number} — ${sourceCard.title}.\n\n${items.map(i => `- ${i.description}${i.notes ? ` (${i.notes})` : ''} — ${i.qty} ${i.unit ?? 'nr'}`).join('\n')}\n${note ? `\n${note}\n` : ''}\nPrice it and send it to the client: ${cardUrl}`,
  })
}
