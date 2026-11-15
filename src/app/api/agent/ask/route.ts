import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { agentGate, askMiaAllowed } from '@/lib/agent/gate'
import { askMia } from '@/lib/agent/ask'
import { isOutOfCredit } from '@/lib/agent/classify'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export const maxDuration = 120

const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(6000),
  })).min(1).max(20),
})

// "Ask Mia" on the assistant's page: one question in, one answer out.
// Admins only, behind settings.ask_mia_enabled. Reads only; never sends mail.
export async function POST(req: Request) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    if (!(await askMiaAllowed(gate.orgId, gate.userId))) {
      return NextResponse.json({ error: 'Ask Mia is for studio admins and is not switched on here' }, { status: 403 })
    }

    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Type a question first' }, { status: 400 })
    const messages = parsed.data.messages
    if (messages[messages.length - 1].role !== 'user') return NextResponse.json({ error: 'Type a question first' }, { status: 400 })

    const [db, { data: mailbox }] = await Promise.all([
      createClient(),
      supabaseAdmin.from('agent_mailboxes').select('agent_name').eq('org_id', gate.orgId).maybeSingle(),
    ])
    const name = mailbox?.agent_name ?? 'Mia'

    try {
      const answer = await askMia(db, gate.orgId, name, messages, async u => {
        await supabaseAdmin.from('agent_usage').insert({
          org_id: gate.orgId,
          email_id: null,
          model: u.model,
          input_tokens: u.inputTokens,
          output_tokens: u.outputTokens,
          cache_read_tokens: u.cacheReadTokens,
          cache_write_tokens: u.cacheWriteTokens,
          cost_usd: u.costUsd,
        })
      })
      return NextResponse.json(answer)
    } catch (e) {
      if (isOutOfCredit(e)) {
        return NextResponse.json({ error: `${name} can't answer: the Claude account is out of credit. Top up, then ask again.` }, { status: 402 })
      }
      // Don't show raw API errors to the studio; the log keeps the detail.
      if (e instanceof Anthropic.APIError) {
        console.error('[ask-mia]', e)
        return NextResponse.json({ error: `${name} couldn't answer just now. Try again in a minute.` }, { status: 502 })
      }
      throw e
    }
  } catch (e) {
    return apiError(e)
  }
}
