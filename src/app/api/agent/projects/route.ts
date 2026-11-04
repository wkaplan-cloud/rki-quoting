import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agentGate } from '@/lib/agent/gate'
import { getNextProjectNumber } from '@/lib/projectNumber'
import { todaySA } from '@/lib/dates'
import { apiError } from '@/lib/api-error'

// A person adding a project from the assistant's page, for mail about a job
// that isn't in QuotingHub yet. The assistant only suggests the name; it never
// creates projects or clients itself.
export async function POST(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const body = await req.json()
    const projectName = typeof body.project_name === 'string' ? body.project_name.trim() : ''
    const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : ''
    if (!projectName) return NextResponse.json({ error: 'Give the project a name' }, { status: 400 })

    const supabase = await createClient()

    let clientId: string | null = null
    if (body.client_id) {
      const { data } = await supabase.from('clients').select('id').eq('id', body.client_id).maybeSingle()
      if (!data) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      clientId = data.id
    } else if (clientName) {
      // A typed name that is already a client is that client, not a second one.
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .ilike('client_name', clientName.replace(/[\\%_]/g, '\\$&'))
        .limit(1)
        .maybeSingle()
      if (existing) {
        clientId = existing.id
      } else {
        const { data: made, error } = await supabase
          .from('clients')
          .insert({ user_id: gate.userId, org_id: gate.orgId, client_name: clientName })
          .select('id')
          .single()
        if (error) throw error
        clientId = made.id
      }
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        project_number: (await getNextProjectNumber(supabase)) ?? '001',
        project_name: projectName,
        user_id: gate.userId,
        org_id: gate.orgId,
        client_id: clientId,
        date: todaySA(),
        status: 'Draft',
        design_fee: 0,
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ id: project.id })
  } catch (e) {
    return apiError(e)
  }
}
