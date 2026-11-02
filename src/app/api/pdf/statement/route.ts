import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { statementsEnabled } from '@/lib/statement'
import { renderStatement } from '@/lib/pdf/renderStatement'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await statementsEnabled(supabase))) {
      return NextResponse.json({ error: 'Statements are not switched on for this studio' }, { status: 403 })
    }

    const rendered = await renderStatement(supabase, clientId, {
      includeSettled: req.nextUrl.searchParams.get('includeSettled') === '1',
    })
    if (!rendered) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return new NextResponse(new Uint8Array(rendered.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${rendered.filename}"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
