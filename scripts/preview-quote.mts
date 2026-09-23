/**
 * Renders a project's quotation PDF straight to a file, no app needed.
 *
 *   npx tsx scripts/preview-quote.mts <project-id> [--out path.pdf]
 *                                     [--no-images] [--template minimal|classic|bold]
 *                                     [--repeat N]
 *
 * Uses the same component, settings and image pre-fetch as /api/pdf/quote, so
 * what lands on disk is exactly what the designer downloads. --template checks
 * a layout the studio isn't on, and --repeat duplicates the line items N times
 * to see how the document paginates once it runs past one page.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'

// Load .env.local the way `next dev` would.
const envPath = path.join(import.meta.dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const args = process.argv.slice(2)
const flagValue = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const noImages = args.includes('--no-images')
const outArg = flagValue('--out')
const templateArg = flagValue('--template')
const repeat = Math.max(1, Number(flagValue('--repeat') ?? 1))
const valueIndexes = new Set(['--out', '--template', '--repeat'].map(f => args.indexOf(f) + 1).filter(i => i > 0))
const projectId = args.find((a, i) => !a.startsWith('--') && !valueIndexes.has(i))
if (!projectId) {
  console.error('usage: npx tsx scripts/preview-quote.mts <project-id> [--out path.pdf] [--no-images] [--template key] [--repeat N]')
  process.exit(1)
}

const { supabaseAdmin } = await import('../src/lib/supabase/admin.js')
const { renderPdfToBuffer } = await import('../src/lib/pdf/render.js')
const { QuotePDF } = await import('../src/lib/pdf/QuotePDF.js')
const { fetchLineItemImages } = await import('../src/lib/pdf/lineItemImages.js')
const { fetchLogoBase64 } = await import('../src/lib/pdf/fetchLogoBase64.js')
const { resolveAcceptance } = await import('../src/lib/acceptance.js')

const { data: project } = await supabaseAdmin
  .from('projects')
  .select('*, client:clients(*)')
  .eq('id', projectId)
  .maybeSingle()
if (!project) { console.error('No project with that id'); process.exit(1) }

const [{ data: lineItems }, { data: settings }] = await Promise.all([
  supabaseAdmin.from('line_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
  supabaseAdmin.from('settings').select('*').eq('org_id', project.org_id).maybeSingle(),
])

// --repeat needs distinct ids: the templates key rows (and their images) by id.
const rows = repeat > 1
  ? Array.from({ length: repeat }).flatMap((_, pass) =>
      (lineItems ?? []).map(item => ({ ...item, id: `${item.id}-${pass}` })))
  : lineItems ?? []

const imagesOn = !noImages
  && (settings?.line_item_images_enabled ?? false)
  && (settings?.show_images_on_documents ?? true)
const [logoUrl, itemImages] = await Promise.all([
  fetchLogoBase64(settings?.logo_url),
  fetchLineItemImages(rows, imagesOn),
])
const templateKey = templateArg ?? settings?.pdf_template ?? 'minimal'

const buffer = await renderPdfToBuffer(
  createElement(QuotePDF, {
    project,
    client: project.client ?? null,
    lineItems: rows,
    type: 'quote',
    templateKey,
    themeKey: settings?.pdf_color_theme ?? 'warm',
    logoUrl,
    businessName: settings?.business_name,
    businessAddress: settings?.business_address,
    vatNumber: settings?.vat_number,
    companyReg: settings?.company_registration,
    bankName: settings?.bank_name,
    bankAccount: settings?.bank_account_number,
    bankBranch: settings?.bank_branch_code,
    footerText: settings?.footer_text,
    termsConditions: settings?.terms_conditions,
    depositPct: project.deposit_percentage ?? settings?.deposit_percentage ?? 50,
    vatRate: project.vat_rate ?? settings?.vat_rate ?? 15,
    quotedDate: project.quoted_date ?? new Date().toISOString().split('T')[0],
    validityDays: settings?.quote_validity_days ?? 30,
    paymentTerms: settings?.payment_terms ?? null,
    leadTime: settings?.lead_time ?? null,
    itemImages,
    acceptance: resolveAcceptance(settings),
  })
)

const out = outArg ?? `Quote-${project.project_number}.pdf`
fs.writeFileSync(out, buffer)
console.log(`${project.project_number} — ${project.project_name}  (${templateKey})`)
console.log(`  rows:   ${rows.length}${repeat > 1 ? ` (${repeat}x)` : ''}`)
console.log(`  images: ${Object.keys(itemImages).length}${imagesOn ? '' : ' (off)'}`)
console.log(`  wrote:  ${path.resolve(out)}`)
