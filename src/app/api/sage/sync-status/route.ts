import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncProjectFromSage } from '@/lib/sage-sync'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')

    const result = await syncProjectFromSage({ db: supabase, projectId, orgId: orgId ?? null })
    if (!result) {
      return NextResponse.json({ error: 'No Sage invoice linked to this project' }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (e: unknown) {
    console.error('[sage/sync-status]', e)
    return NextResponse.json({ error: 'Failed to sync invoice status from Sage. Please try again.' }, { status: 500 })
  }
}
