import { NextResponse } from 'next/server'
import { runAgentForOrg } from '@/lib/agent/process'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

export const maxDuration = 300

// "Check now" on the Assistant page — the same pass the cron runs.
export async function POST() {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const summary = await runAgentForOrg(gate.orgId)
    if (summary.error) return NextResponse.json({ error: summary.error, summary }, { status: 502 })
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    return apiError(e)
  }
}
