import { createElement } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { sendEmail } from '@/lib/email'
import { getElecSageStatus } from '@/lib/sage-elec'
import { pushSageInvoice } from '@/lib/sage-invoice'
import { fmtRand } from '@/lib/contract-format'
import { ElecContractInvoicePDF } from '@/lib/pdf/ElecContractInvoicePDF'
import type { ElecContractInvoice, ElecServiceContract, ElecClient, ElecSettings } from '@/lib/elec-types'

/**
 * A support invoice's life after it's raised: its PDF, the email to the
 * client, and the copy in Sage. All scoped to the account that owns it.
 */

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function load(accountId: string, invoiceId: string) {
  const { data: invoice } = await supabaseAdmin
    .from('elec_contract_invoices').select('*').eq('id', invoiceId).eq('portal_account_id', accountId).maybeSingle()
  if (!invoice) return null
  const [{ data: contract }, { data: settings }, { data: account }] = await Promise.all([
    supabaseAdmin.from('elec_service_contracts').select('*, client:elec_clients(*)').eq('id', invoice.contract_id).eq('portal_account_id', accountId).maybeSingle(),
    supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', accountId).maybeSingle(),
    supabaseAdmin.from('supplier_portal_accounts').select('company_name, email, logo_url').eq('id', accountId).maybeSingle(),
  ])
  if (!contract || !account) return null
  const client = (Array.isArray(contract.client) ? contract.client[0] : contract.client) as ElecClient | null
  return {
    invoice: invoice as ElecContractInvoice,
    contract: contract as ElecServiceContract,
    client,
    settings: (settings ?? null) as ElecSettings | null,
    companyName: (account.company_name ?? account.email) as string,
    companyEmail: account.email as string,
    logoUrl: account.logo_url as string | null,
  }
}

export async function renderContractInvoice(accountId: string, invoiceId: string) {
  const ctx = await load(accountId, invoiceId)
  if (!ctx) return null
  const buffer = await renderPdfToBuffer(createElement(ElecContractInvoicePDF, {
    invoice: ctx.invoice, contract: ctx.contract, client: ctx.client, settings: ctx.settings,
    companyName: ctx.companyName, companyEmail: ctx.companyEmail, logoUrl: await fetchLogoBase64(ctx.logoUrl),
  }))
  return { ...ctx, buffer }
}

/** Emails the invoice to the client (or the given address) and marks it sent. */
export async function sendContractInvoice(accountId: string, invoiceId: string, to?: string | null): Promise<{ ok: true } | { error: string }> {
  const r = await renderContractInvoice(accountId, invoiceId)
  if (!r) return { error: 'Invoice not found' }
  if (r.invoice.status === 'void') return { error: 'This invoice has been voided' }
  const email = (to ?? r.client?.email ?? '').trim()
  if (!email) return { error: 'The client has no email address — add one on their client record' }

  const total = r.invoice.amount * (1 + r.invoice.vat_rate / 100)
  const name = r.client?.client_name ? `Hi ${esc(r.client.client_name)},` : 'Hi,'
  await sendEmail({
    from: `${r.companyName} via QuotingHub <noreply@quotinghub.co.za>`,
    replyTo: r.companyEmail,
    to: email,
    subject: `Invoice ${r.invoice.invoice_number} – ${r.contract.name}`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#1F5C45;padding:28px 36px;border-radius:8px 8px 0 0;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">${esc(r.companyName)}</p>
    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.08em;text-transform:uppercase;">Support plan invoice</p>
  </td></tr>
  <tr><td style="background:#fff;padding:32px 36px;border-left:1px solid #E4E4E7;border-right:1px solid #E4E4E7;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#18181B;">${name}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#18181B;">Please find attached invoice <strong>${esc(r.invoice.invoice_number)}</strong> for your <strong>${esc(r.contract.name)}</strong> support plan.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;border-radius:8px;margin-bottom:24px;"><tr>
      <td style="padding:14px 18px;"><p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Amount due (incl. VAT)</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#18181B;">${fmtRand(total)}</p></td>
      <td style="padding:14px 18px;border-left:1px solid #E4E4E7;"><p style="margin:0;font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;">Due</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${esc(r.invoice.due_date ?? r.invoice.invoice_date)}</p></td>
    </tr></table>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#18181B;">Kind regards,<br><strong>${esc(r.companyName)}</strong><br>
      <a href="mailto:${esc(r.companyEmail)}" style="color:#1F5C45;text-decoration:none;">${esc(r.companyEmail)}</a></p>
  </td></tr>
  <tr><td style="background:#F0F2F5;border:1px solid #E4E4E7;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
    <p style="margin:0;font-size:12px;color:#71717A;">Sent via <a href="https://quotinghub.co.za" style="color:#1F5C45;text-decoration:none;">QuotingHub</a></p>
  </td></tr>
</table></td></tr></table></body></html>`,
    text: `${r.client?.client_name ? `Hi ${r.client.client_name},` : 'Hi,'}\n\nPlease find attached invoice ${r.invoice.invoice_number} for your ${r.contract.name} support plan.\n\nAmount due (incl. VAT): ${fmtRand(total)}\nDue: ${r.invoice.due_date ?? r.invoice.invoice_date}\n\nKind regards,\n${r.companyName}\n${r.companyEmail}`,
    attachments: [{ filename: `${r.invoice.invoice_number}.pdf`, content: Buffer.from(r.buffer).toString('base64') }],
  })

  if (r.invoice.status === 'draft') {
    await supabaseAdmin.from('elec_contract_invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId).eq('portal_account_id', accountId)
  } else {
    await supabaseAdmin.from('elec_contract_invoices')
      .update({ sent_at: new Date().toISOString() }).eq('id', invoiceId).eq('portal_account_id', accountId)
  }
  return { ok: true }
}

/** Creates the invoice in Sage for the contract's linked Sage customer. */
export async function pushContractInvoiceToSage(accountId: string, invoiceId: string): Promise<{ ok: true; sage_invoice_id: string } | { error: string }> {
  const ctx = await load(accountId, invoiceId)
  if (!ctx) return { error: 'Invoice not found' }
  if (ctx.invoice.status === 'void') return { error: 'This invoice has been voided' }
  if (!ctx.contract.sage_customer_id) return { error: 'Link this contract to a Sage customer first' }
  if ((ctx.invoice.sage_invoice_status ?? '').toUpperCase() === 'PAID') return { error: 'This invoice is already paid in Sage' }
  const status = await getElecSageStatus(accountId)
  if (!status.connected) return { error: 'Sage is not connected — connect it in Settings' }

  const pushed = await pushSageInvoice({
    portalAccountId: accountId,
    sageCustomerId: ctx.contract.sage_customer_id,
    selectionId: (ctx.settings as { sage_item_id?: number | null } | null)?.sage_item_id ?? 1,
    reference: ctx.invoice.invoice_number,
    description: `${ctx.contract.name} – ${ctx.invoice.period_start} to ${ctx.invoice.period_end}`,
    lineDescription: `${ctx.contract.name} support plan, ${ctx.invoice.period_start} to ${ctx.invoice.period_end}`,
    amountExclVat: ctx.invoice.amount,
    dueDate: new Date((ctx.invoice.due_date ?? ctx.invoice.invoice_date) + 'T12:00:00'),
    existingSageId: ctx.invoice.sage_invoice_id,
  })
  await supabaseAdmin.from('elec_contract_invoices').update({
    sage_invoice_id: pushed.id, sage_invoice_status: pushed.status, sage_pushed_at: new Date().toISOString(),
  }).eq('id', invoiceId).eq('portal_account_id', accountId)
  return { ok: true, sage_invoice_id: pushed.id }
}
