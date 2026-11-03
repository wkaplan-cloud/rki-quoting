import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/sage-crypto'
import { testLogin } from '@/lib/agent/mailbox'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

// Connect (or reconnect) the assistant's Gmail inbox. The app password is
// checked against Gmail before it is stored, and is never sent back out.
export async function PUT(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res

    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const appPassword = String(body.appPassword ?? '').replace(/\s+/g, '')
    const agentName = String(body.agentName ?? '').trim() || 'Mia'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter the assistant’s Gmail address' }, { status: 400 })
    if (appPassword.length !== 16) return NextResponse.json({ error: 'A Google app password is 16 letters' }, { status: 400 })

    try {
      await testLogin({ email, appPassword })
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `Gmail refused the login. Check the address and app password, and that IMAP is on. (${why})` }, { status: 400 })
    }

    // A different address means a different inbox: start its UID tracking fresh.
    const { data: existing } = await supabaseAdmin.from('agent_mailboxes').select('email').eq('org_id', gate.orgId).maybeSingle()
    const sameInbox = existing?.email === email

    const { error } = await supabaseAdmin.from('agent_mailboxes').upsert({
      org_id: gate.orgId,
      agent_name: agentName,
      email,
      app_password_enc: encrypt(appPassword),
      last_error: null,
      updated_at: new Date().toISOString(),
      ...(sameInbox ? {} : { last_uid: null, uid_validity: null, last_checked_at: null }),
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// Rename only — no password needed.
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
