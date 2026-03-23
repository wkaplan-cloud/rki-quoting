import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { POPDF } from '@/lib/pdf/POPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supplierId = req.nextUrl.searchParams.get('supplierId')

  const supabase = await createClient()
  const [{ data: project }, { data: allLineItems }, { data: suppliers }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('suppliers').select('*'),
    supabase.from('settings').select('vat_rate, logo_url, business_name').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lineItems = supplierId
    ? (() => {
        // Include section rows only if they have at least one item for this supplier beneath them
        const all = allLineItems ?? []
        const result: typeof all = []
        let pendingSection: typeof all[number] | null = null
        for (const item of all) {
          if (item.row_type === 'section') {
            pendingSection = item
          } else if (item.supplier_id === supplierId) {
            if (pendingSection) { result.push(pendingSection); pendingSection = null }
            result.push(item)
          }
        }
        return result
      })()
    : (allLineItems ?? [])

  const supplier = supplierId ? (suppliers ?? []).find(s => s.id === supplierId) ?? null : null
  const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  const filename = supplier
    ? `${slug(project.project_number)}_PO_${slug(supplier.supplier_name)}.pdf`
    : `${project.project_number}-po.pdf`

  const logoUrl = await fetchLogoBase64(settings?.logo_url)

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(POPDF, { project, lineItems, suppliers: suppliers ?? [], supplierId: supplierId ?? undefined, vatRate: settings?.vat_rate ?? 15, logoUrl, businessName: settings?.business_name }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
