import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agentGate } from '@/lib/agent/gate'
import { retryEmail } from '@/lib/agent/process'
import { syncEmailToDrive } from '@/lib/agent/drive-sync'
import { apiError } from '@/lib/api-error'

const STATUSES = ['new', 'done']

// The supplier's original wording. Fetched on demand so the page isn't carrying up to 200 full emails.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase.from('agent_emails').select('body_text').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ text: data.body_text ?? '' })
  } catch (e) {
    return apiError(e)
  }
}

// A person correcting the filing: move to another project/supplier, or mark done.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { id } = await params
    const body = await req.json()
    const supabase = await createClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), filed_by: gate.userId }
    if ('project_id' in body) {
      if (body.project_id) {
        const { data } = await supabase.from('projects').select('id').eq('id', body.project_id).maybeSingle()
        if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      updates.project_id = body.project_id || null
      updates.match_confidence = 'high'
      updates.match_reason = 'Filed by a person'
    }
    if ('supplier_id' in body) {
      if (body.supplier_id) {
        const { data } = await supabase.from('suppliers').select('id').eq('id', body.supplier_id).maybeSingle()
        if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      updates.supplier_id = body.supplier_id || null
    }
    if ('status' in body) {
      if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
      updates.status = body.status
    }

    const { data, error } = await supabase.from('agent_emails').update(updates).eq('id', id).select('id').maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Refiled to a project: its PDFs go to (or move to) that project's Drive folder.
    if (updates.project_id) await syncEmailToDrive(gate.orgId, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// Read it again — for an email whose first read failed.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { id } = await params
    const outcome = await retryEmail(gate.orgId, id)
    if (outcome !== 'filed') return NextResponse.json({ error: outcome }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
