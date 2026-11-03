import { NextResponse } from 'next/server'
import { agentGate } from '@/lib/agent/gate'
import { retryFailed } from '@/lib/agent/process'
import { apiError } from '@/lib/api-error'

export const maxDuration = 300

// "Read all again" after a top-up: 8 per press (a PDF read can take ~20s),
// so one request stays inside the function time limit.
export async function POST() {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    return NextResponse.json({ ok: true, ...(await retryFailed(gate.orgId)) })
  } catch (e) {
    return apiError(e)
  }
}
