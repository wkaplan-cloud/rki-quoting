import { createElement } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/sage-crypto'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { todaySA } from '@/lib/dates'
import { ElecHandoverPDF, type HandoverDevice, type HandoverServicePlan } from '@/lib/pdf/ElecHandoverPDF'
import type { ElecQuote, ElecClient, ElecSettings } from '@/lib/elec-types'

/**
 * Builds the handover pack for a project. Passwords are decrypted only when
 * the caller asked for credentials, and never leave this function any other
 * way than printed in the PDF.
 */
export async function buildHandoverPack(opts: {
  accountId: string
  quoteId: string
  includeCredentials: boolean
  servicePlan?: HandoverServicePlan | null
}): Promise<{ buffer: Buffer; quote: ElecQuote; client: ElecClient | null; companyName: string; companyEmail: string } | null> {
  const { accountId, quoteId, includeCredentials } = opts

  const [{ data: quoteRaw }, { data: settings }, { data: account }, { data: deviceRows }] = await Promise.all([
    supabaseAdmin.from('elec_quotes').select('*, client:elec_clients(*)').eq('id', quoteId).eq('portal_account_id', accountId).maybeSingle(),
    supabaseAdmin.from('elec_settings').select('*').eq('portal_account_id', accountId).maybeSingle(),
    supabaseAdmin.from('supplier_portal_accounts').select('company_name, email, phone, logo_url').eq('id', accountId).maybeSingle(),
    supabaseAdmin.from('elec_devices')
      .select('room, category, brand, model, description, serial_number, mac_address, ip_address, warranty_until, username, password_encrypted')
      .eq('quote_id', quoteId).eq('portal_account_id', accountId)
      .order('room', { nullsFirst: false }).order('created_at'),
  ])
  if (!quoteRaw || !account) return null

  const client = (Array.isArray(quoteRaw.client) ? quoteRaw.client[0] : quoteRaw.client) as ElecClient | null
  const devices: HandoverDevice[] = (deviceRows ?? []).map(({ password_encrypted, ...d }) => ({
    ...d,
    username: includeCredentials ? d.username : null,
    password: includeCredentials && password_encrypted ? decrypt(password_encrypted) : null,
  }))

  const companyName = account.company_name ?? account.email ?? 'Your installer'
  const buffer = await renderPdfToBuffer(createElement(ElecHandoverPDF, {
    quote: quoteRaw as ElecQuote,
    client,
    settings: (settings ?? null) as ElecSettings | null,
    devices,
    includeCredentials,
    servicePlan: opts.servicePlan ?? null,
    companyName,
    companyEmail: account.email,
    companyPhone: account.phone ?? null,
    logoUrl: await fetchLogoBase64(account.logo_url),
    handoverDate: todaySA(),
  }))

  return { buffer, quote: quoteRaw as ElecQuote, client, companyName, companyEmail: account.email }
}
