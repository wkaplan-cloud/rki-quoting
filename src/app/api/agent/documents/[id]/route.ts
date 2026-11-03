import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { agentGate } from '@/lib/agent/gate'
import { apiError } from '@/lib/api-error'

// Open a filed PDF: RLS proves the document is this studio's, then a short-lived link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    const { id } = await params
    const supabase = await createClient()
    const { data: doc } = await supabase.from('agent_documents').select('storage_path, filename').eq('id', id).maybeSingle()
    if (!doc?.storage_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data, error } = await supabaseAdmin.storage.from('agent-documents').createSignedUrl(doc.storage_path, 300)
    if (error || !data) throw error ?? new Error('Could not open the file')
    return NextResponse.redirect(data.signedUrl)
  } catch (e) {
    return apiError(e)
  }
}
