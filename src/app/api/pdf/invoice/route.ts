import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('logo_url, business_name, footer_text').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(QuotePDF, { project, client: project.client ?? null, lineItems: lineItems ?? [], type: 'invoice', logoUrl: settings?.logo_url, businessName: settings?.business_name, footerText: settings?.footer_text }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${project.project_number}-invoice.pdf"`,
    },
  })
}
