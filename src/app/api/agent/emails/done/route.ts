import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })

// "Mark all as done" on the assistant's page: the emails in the list the
// person is looking at. Only ones still 'new' — an email that failed to read
// needs "Read again", not hiding.
export async function POST(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Nothing to mark' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase.from('agent_emails')
      .update({ status: 'done', filed_by: gate.userId, updated_at: new Date().toISOString() })
      .eq('org_id', gate.orgId)
      .eq('status', 'new')
      .in('id', parsed.data.ids)
      .select('id')
    if (error) throw error
    return NextResponse.json({ ok: true, marked: data?.length ?? 0 })
  } catch (e) {
    return apiError(e)
  }
}
