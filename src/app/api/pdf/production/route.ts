import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ProductionPDF } from '@/lib/pdf/ProductionPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [{ data: project }, { data: lineItems }, { data: suppliers }, { data: settings }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(client_name)').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('suppliers').select('*'),
      supabase.from('settings').select('logo_url, business_name, vat_rate').maybeSingle(),
    ])

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const assignedUserId = (project as any).assigned_to ?? project.user_id
    let assignedToName: string | null = null
    if (assignedUserId && orgId) {
      const { data: member } = await supabaseAdmin
        .from('org_members')
        .select('full_name, invited_email')
        .eq('user_id', assignedUserId)
        .eq('org_id', orgId)
        .maybeSingle()
      if (member) assignedToName = member.full_name ?? member.invited_email?.split('@')[0] ?? null
    }

    const logoUrl = await fetchLogoBase64(settings?.logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(ProductionPDF, { project, lineItems: lineItems ?? [], suppliers: suppliers ?? [], logoUrl, businessName: settings?.business_name, vatRate: project.vat_rate ?? settings?.vat_rate ?? 15, printDate: new Date().toISOString(), assignedTo: assignedToName }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Production-${project.project_number}.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
