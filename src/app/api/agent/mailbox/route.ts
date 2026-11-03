import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { inboundAddress, inboundDomain, newInboundToken } from '@/lib/agent/inbound'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

// Give the studio's assistant its receiving address. Once made, the address
// never changes — the studio's Gmail forwarding filters point at it — so a
// rename only changes the name shown in QuotingHub.
export async function POST(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const domain = inboundDomain()
    if (!domain) return NextResponse.json({ error: 'Inbound mail is not configured on the server (RESEND_INBOUND_DOMAIN)' }, { status: 500 })

    const { data: existing } = await supabaseAdmin.from('agent_mailboxes').select('email').eq('org_id', gate.orgId).maybeSingle()
    if (existing) return NextResponse.json({ ok: true, email: existing.email })

    const { agentName } = await req.json()
    const name = String(agentName ?? '').trim() || 'Mia'
    const token = newInboundToken()
    const email = inboundAddress(name, token, domain)

    const { error } = await supabaseAdmin.from('agent_mailboxes').insert({
      org_id: gate.orgId,
      agent_name: name,
      email,
      inbound_token: token,
    })
    if (error) throw error
    return NextResponse.json({ ok: true, email })
  } catch (e) {
    return apiError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { agentName } = await req.json()
    const name = String(agentName ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Give the assistant a name' }, { status: 400 })
    const { error } = await supabaseAdmin.from('agent_mailboxes')
      .update({ agent_name: name, updated_at: new Date().toISOString() })
      .eq('org_id', gate.orgId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
