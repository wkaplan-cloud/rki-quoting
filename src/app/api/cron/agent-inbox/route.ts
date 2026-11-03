import { NextRequest, NextResponse } from 'next/server'
import { agentOrgIds, runAgentForOrg } from '@/lib/agent/process'

export const maxDuration = 300

// Every 10 minutes from cron-job.org: read each studio assistant's new mail.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results = []
  for (const orgId of await agentOrgIds()) {
    results.push(await runAgentForOrg(orgId))
  }
  return NextResponse.json({ ok: true, results })
}
