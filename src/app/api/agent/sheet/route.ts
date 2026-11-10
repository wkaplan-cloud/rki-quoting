import { NextResponse } from 'next/server'
import { agentGate } from '@/lib/agent/gate'
import { syncSheet } from '@/lib/agent/sheet'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

// "Update now" on the assistant's page: rebuild the Supplier Prices sheet,
// creating it (Mia folder / Accounts) the first time.
export async function POST() {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const result = await syncSheet(gate.orgId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
    return NextResponse.json({ ok: true, url: result.url })
  } catch (e) {
    return apiError(e)
  }
}
