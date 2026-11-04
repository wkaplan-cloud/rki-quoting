import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

const TABLES = { quote: 'agent_documents', rfq: 'rfq_requests' } as const

// A person has dealt with a line on the "To chase" list, so it stops showing.
export async function POST(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { kind, id } = await req.json()
    const table = TABLES[kind as keyof typeof TABLES]
    if (!table || typeof id !== 'string') return NextResponse.json({ error: 'Unknown item' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ chase_done_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', gate.orgId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
