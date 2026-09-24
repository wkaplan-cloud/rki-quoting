import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { sendEmail } from '@/lib/email'
import { todaySA } from '@/lib/dates'
import { addDays, fmtRand } from '@/lib/contract-format'
import { raiseNextInvoice, rollRenewal } from '@/lib/service-contracts'
import { sendContractInvoice, pushContractInvoiceToSage } from '@/lib/contract-invoices'
import type { ElecServiceContract } from '@/lib/elec-types'

export const maxDuration = 300

// Runs daily (vercel.json, 04:00 UTC = 06:00 SAST). For every active support plan:
//  1. rolls it past its renewal date — another year, or ended if it doesn't auto-renew
//  2. warns the installer 30 days before renewal, once per renewal date
//  3. raises every invoice that has come due (catching up if a day was missed),
//     then emails and Sage-pushes them if the account has auto-send on, or
//     leaves them as drafts and tells the office they're waiting.

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todaySA()
  const { rows: contracts, error } = await fetchAllRows<ElecServiceContract>((from, to) => supabaseAdmin
    .from('elec_service_contracts').select('*').eq('status', 'active').order('id').range(from, to))
  if (error) return NextResponse.json({ error }, { status: 500 })

  const summary = { renewed: 0, ended: 0, reminders: 0, invoices: 0, sent: 0, failures: [] as string[] }
  const draftsByAccount = new Map<string, number>()
  const settingsCache = new Map<string, { autoSend: boolean; email: string | null; company: string }>()

  async function accountInfo(accountId: string) {
    if (!settingsCache.has(accountId)) {
      const [{ data: s }, { data: a }] = await Promise.all([
        supabaseAdmin.from('elec_settings').select('contract_invoices_auto_send').eq('portal_account_id', accountId).maybeSingle(),
        supabaseAdmin.from('supplier_portal_accounts').select('email, company_name').eq('id', accountId).maybeSingle(),
      ])
      settingsCache.set(accountId, { autoSend: s?.contract_invoices_auto_send === true, email: a?.email ?? null, company: a?.company_name ?? '' })
    }
    return settingsCache.get(accountId)!
  }

  for (let contract of contracts) {
    try {
      // 1. Renewal
      if (contract.renewal_date <= today) {
        const outcome = await rollRenewal(contract)
        if (outcome === 'ended') { summary.ended++; continue }
        summary.renewed++
        const { data: fresh } = await supabaseAdmin.from('elec_service_contracts').select('*').eq('id', contract.id).single()
        contract = fresh as ElecServiceContract
      }

      // 2. Renewal reminder, 30 days out
      if (addDays(today, 30) >= contract.renewal_date && contract.renewal_reminder_sent_for !== contract.renewal_date) {
        const info = await accountInfo(contract.portal_account_id)
        const { data: client } = await supabaseAdmin.from('elec_clients').select('client_name').eq('id', contract.client_id).maybeSingle()
        const who = client?.client_name ?? 'A client'
        const line = contract.auto_renew
          ? `${who}'s ${contract.name} plan renews automatically on ${contract.renewal_date}.`
          : `${who}'s ${contract.name} plan ends on ${contract.renewal_date} — it is not set to renew.`
        await supabaseAdmin.from('elec_notifications').insert({
          portal_account_id: contract.portal_account_id, type: 'contract_renewal',
          title: `Support plan ${contract.auto_renew ? 'renewing' : 'ending'} — ${who}`, body: line,
          metadata: { contract_id: contract.id },
        })
        if (info.email) {
          await sendEmail({
            from: 'QuotingHub <noreply@quotinghub.co.za>',
            to: info.email,
            subject: `${contract.auto_renew ? 'Renewing' : 'Ending'} in 30 days: ${who} — ${contract.name}`,
            html: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181B;">${esc(line)}</p>
<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181B;">Plan fee: ${fmtRand(contract.fee)} ${contract.billing_period === 'annual' ? 'a year' : 'a month'} (ex VAT). A good moment to check in with the client${contract.auto_renew ? ' or review the price' : ' and offer a renewal'}.</p>
<p style="font-family:Arial,sans-serif;font-size:13px;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/contracts" style="color:#1F5C45;">Open Contracts →</a></p>`,
            text: `${line}\n\nOpen Contracts: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'}/supplier-portal/quoting/contracts`,
          }).catch(() => {})
        }
        await supabaseAdmin.from('elec_service_contracts').update({ renewal_reminder_sent_for: contract.renewal_date }).eq('id', contract.id)
        summary.reminders++
      }

      // 3. Invoices due. A plan that won't renew is never billed past its end.
      for (let guard = 0; guard < 24; guard++) {
        if (!contract.next_invoice_date || contract.next_invoice_date > today) break
        if (!contract.auto_renew && contract.next_invoice_date >= contract.renewal_date) break
        const invoice = await raiseNextInvoice(contract)
        const { data: fresh } = await supabaseAdmin.from('elec_service_contracts').select('*').eq('id', contract.id).single()
        contract = fresh as ElecServiceContract
        if (!invoice) continue
        summary.invoices++

        const info = await accountInfo(contract.portal_account_id)
        if (info.autoSend) {
          const sent = await sendContractInvoice(contract.portal_account_id, invoice.id)
          if ('ok' in sent) summary.sent++
          else summary.failures.push(`${invoice.invoice_number}: ${sent.error}`)
          if (contract.sage_customer_id) {
            const pushed = await pushContractInvoiceToSage(contract.portal_account_id, invoice.id).catch(e => ({ error: String(e) }))
            if ('error' in pushed) summary.failures.push(`${invoice.invoice_number} Sage: ${pushed.error}`)
          }
        } else {
          draftsByAccount.set(contract.portal_account_id, (draftsByAccount.get(contract.portal_account_id) ?? 0) + 1)
        }
      }
    } catch (e) {
      summary.failures.push(`${contract.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // One note per account for drafts waiting on the office.
  for (const [accountId, count] of draftsByAccount) {
    await supabaseAdmin.from('elec_notifications').insert({
      portal_account_id: accountId, type: 'invoice',
      title: `${count} support invoice${count === 1 ? '' : 's'} ready to send`,
      body: 'Raised today from your support plans. Review and send them from Contracts.',
      metadata: {},
    })
  }

  return NextResponse.json({ ok: true, date: today, ...summary })
}
