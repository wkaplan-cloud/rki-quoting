import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { POPDF } from '@/lib/pdf/POPDF'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: project }, { data: lineItems }, { data: suppliers }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('suppliers').select('*'),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(POPDF, { project, lineItems: lineItems ?? [], suppliers: suppliers ?? [] }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${project.project_number}-po.pdf"`,
    },
  })
}
