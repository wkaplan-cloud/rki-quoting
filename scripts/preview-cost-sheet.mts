/**
 * Renders a project's Job Cost Sheet PDF straight to a file, no app needed.
 *
 *   npx tsx scripts/preview-cost-sheet.mts <project-id> [--out path.pdf] [--no-images]
 *
 * Uses the same component and the same image pre-fetch as /api/pdf/production,
 * so what lands on disk is exactly what the designer downloads. Images obey the
 * org's own line_item_images_enabled / show_images_on_documents settings unless
 * --no-images is passed, which is handy for comparing the two layouts.
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
const noImages = args.includes('--no-images')
const outIdx = args.indexOf('--out')
const outArg = outIdx >= 0 ? args[outIdx + 1] : undefined
const projectId = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1)
if (!projectId) {
  console.error('usage: npx tsx scripts/preview-cost-sheet.mts <project-id> [--out path.pdf] [--no-images]')
  process.exit(1)
}

const { supabaseAdmin } = await import('../src/lib/supabase/admin.js')
const { renderPdfToBuffer } = await import('../src/lib/pdf/render.js')
const { ProductionPDF } = await import('../src/lib/pdf/ProductionPDF.js')
const { fetchLineItemImages } = await import('../src/lib/pdf/lineItemImages.js')

const { data: project } = await supabaseAdmin
  .from('projects')
  .select('*, client:clients(client_name)')
  .eq('id', projectId)
  .maybeSingle()
if (!project) { console.error('No project with that id'); process.exit(1) }

const [{ data: lineItems }, { data: suppliers }, { data: settings }] = await Promise.all([
  supabaseAdmin.from('line_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
  supabaseAdmin.from('suppliers').select('*').eq('org_id', project.org_id),
  supabaseAdmin.from('settings')
    .select('business_name, vat_rate, line_item_images_enabled, show_images_on_documents')
    .eq('org_id', project.org_id).maybeSingle(),
])

const imagesOn = !noImages
  && (settings?.line_item_images_enabled ?? false)
  && (settings?.show_images_on_documents ?? true)
const images = await fetchLineItemImages(lineItems ?? [], imagesOn)

const buffer = await renderPdfToBuffer(
  createElement(ProductionPDF, {
    project,
    lineItems: lineItems ?? [],
    suppliers: suppliers ?? [],
    businessName: settings?.business_name,
    vatRate: project.vat_rate ?? settings?.vat_rate ?? 15,
    printDate: new Date().toISOString(),
    images,
  })
)

const out = outArg ?? `JobCostSheet-${project.project_number}.pdf`
fs.writeFileSync(out, buffer)
console.log(`${project.project_number} — ${project.project_name}`)
console.log(`  rows:   ${(lineItems ?? []).length}`)
console.log(`  images: ${Object.keys(images).length}${imagesOn ? '' : ' (off)'}`)
console.log(`  wrote:  ${path.resolve(out)}`)
