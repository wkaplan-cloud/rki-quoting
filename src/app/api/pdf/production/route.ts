import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProductionPDF } from '@/lib/pdf/ProductionPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: project }, { data: lineItems }, { data: suppliers }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('suppliers').select('*'),
    supabase.from('settings').select('logo_url, business_name, vat_rate').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const logoUrl = await fetchLogoBase64(settings?.logo_url)

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(ProductionPDF, { project, lineItems: lineItems ?? [], suppliers: suppliers ?? [], logoUrl, businessName: settings?.business_name, vatRate: project.vat_rate ?? settings?.vat_rate ?? 15 }) as any
  )

  const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug(project.project_number)}_Production.pdf"`,
    },
  })
}
