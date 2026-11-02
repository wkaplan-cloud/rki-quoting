import { createElement } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { todaySA } from '@/lib/dates'
import { loadStatement, type Statement } from '@/lib/statement'
import { renderPdfToBuffer } from './render'
import { StatementPDF } from './StatementPDF'
import { fetchLogoBase64 } from './fetchLogoBase64'
import { resolveTheme } from './themes'

/**
 * Loads a client's statement and renders it as a PDF. Shared by the download
 * route, the statement email and the "attach statement" option on invoice emails.
 * Returns null when the client isn't visible to the caller.
 */
export async function renderStatement(
  supabase: SupabaseClient,
  clientId: string,
  opts: { includeSettled?: boolean } = {},
): Promise<{ buffer: Buffer; statement: Statement; filename: string } | null> {
  const [statement, { data: settings }] = await Promise.all([
    loadStatement(supabase, clientId, opts),
    supabase.from('settings').select('logo_url, business_name, business_address, vat_number, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, pdf_color_theme').maybeSingle(),
  ])
  if (!statement) return null

  const asAt = todaySA()
  const buffer = await renderPdfToBuffer(
    createElement(StatementPDF, {
      statement,
      theme: resolveTheme(settings?.pdf_color_theme ?? 'warm'),
      asAt,
      logoUrl: await fetchLogoBase64(settings?.logo_url),
      businessName: settings?.business_name,
      businessAddress: settings?.business_address,
      vatNumber: settings?.vat_number,
      companyReg: settings?.company_registration,
      bankName: settings?.bank_name,
      bankAccount: settings?.bank_account_number,
      bankBranch: settings?.bank_branch_code,
      footerText: settings?.footer_text,
    }),
  )

  const slug = statement.client.client_name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')
  return { buffer, statement, filename: `Statement-${slug || 'client'}-${asAt}.pdf` }
}
