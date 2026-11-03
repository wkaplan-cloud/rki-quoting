import { supabaseAdmin } from '@/lib/supabase/admin'
import { gmailForwardingRequest, type InboundEmail } from './inbound'
import { classifyEmail, AGENT_MODEL, type StudioContext } from './classify'
import { syncEmailToDrive } from './drive-sync'

// Filing one email for one studio. Every email gets a row whatever happens —
// a failed read is stored with its error and shown on the assistant's page,
// never only logged, because a quote that silently vanished looks exactly
// like a supplier who never replied.

async function loadContext(orgId: string): Promise<StudioContext> {
  const [{ data: settings }, { data: suppliers }, { data: projects }, { data: rfqs }] = await Promise.all([
    supabaseAdmin.from('settings').select('business_name').eq('org_id', orgId).maybeSingle(),
    supabaseAdmin.from('suppliers').select('id, supplier_name, email').eq('org_id', orgId).order('supplier_name'),
    supabaseAdmin
      .from('projects')
      .select('id, project_number, project_name, status, clients(client_name)')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(300),
    supabaseAdmin
      .from('rfq_requests')
      .select('id, supplier_name, supplier_email, submitted_at, created_at, studio_boards(name)')
      .eq('org_id', orgId)
      .gte('created_at', new Date(Date.now() - 120 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  return {
    studioName: settings?.business_name ?? 'the studio',
    suppliers: (suppliers ?? []).map(s => ({ id: s.id, name: s.supplier_name, email: s.email })),
    projects: (projects ?? []).map(p => ({
      id: p.id,
      number: p.project_number,
      name: p.project_name,
      client: one(p.clients as { client_name: string } | { client_name: string }[] | null)?.client_name ?? null,
      status: p.status,
    })),
    rfqs: (rfqs ?? []).map(r => ({
      id: r.id,
      supplier: r.supplier_name,
      email: r.supplier_email,
      board: one(r.studio_boards as { name: string } | { name: string }[] | null)?.name ?? null,
      sent: r.created_at.slice(0, 10),
      submitted: !!r.submitted_at,
    })),
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file'
}

export async function fileInbound(orgId: string, email: InboundEmail): Promise<'filed' | 'failed' | 'skipped'> {
  const forwarding = gmailForwardingRequest(email)

  const { data: row, error: insertError } = await supabaseAdmin
    .from('agent_emails')
    .insert({
      org_id: orgId,
      message_id: email.messageId,
      resend_email_id: email.resendId,
      from_email: email.fromEmail,
      from_name: email.fromName,
      subject: email.subject,
      received_at: email.receivedAt?.toISOString() ?? null,
      body_text: email.text.slice(0, 50_000),
      model: forwarding ? null : AGENT_MODEL,
      // Gmail's forwarding check isn't supplier mail; it only needs its code read back.
      ...(forwarding && {
        kind: 'other',
        summary: 'Gmail is asking to confirm that mail may be forwarded here.',
        action_needed: forwarding.code
          ? `Gmail forwarding confirmation code: ${forwarding.code}. Enter it in Gmail → Settings → Forwarding to finish setting up.`
          : `Open this link while signed in to the inbox that asked, to allow forwarding: ${forwarding.link}`,
        match_confidence: 'high',
      }),
    })
    .select('id')
    .single()

  // Unique (org_id, message_id): Resend retried a webhook we already handled.
  if (insertError?.code === '23505') return 'skipped'
  if (insertError || !row) throw new Error(`Could not store email: ${insertError?.message}`)

  await supabaseAdmin.from('agent_mailboxes')
    .update({ last_received_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)

  if (forwarding) return 'filed'

  // Keep the originals before reading them, so a failed read still leaves the PDF to open.
  const stored = await Promise.all(email.attachments.map(async (a, i) => {
    const path = `${orgId}/${row.id}/${i}-${safeName(a.filename)}`
    const { error } = await supabaseAdmin.storage.from('agent-documents').upload(path, a.content, {
      contentType: a.contentType || 'application/octet-stream',
      upsert: true,
    })
    return { a, path: error ? null : path, uploadError: error?.message ?? null }
  }))

  return readAndFile(orgId, row.id, email, stored, await loadContext(orgId))
}

interface StoredAttachment {
  a: InboundEmail['attachments'][number]
  path: string | null
  uploadError: string | null
}

async function readAndFile(
  orgId: string,
  rowId: string,
  email: InboundEmail,
  stored: StoredAttachment[],
  ctx: StudioContext,
): Promise<'filed' | 'failed'> {
  const row = { id: rowId }
  try {
    const result = await classifyEmail(email, ctx)

    await supabaseAdmin.from('agent_emails').update({
      error: null,
      kind: result.kind,
      supplier_id: result.supplier_id,
      supplier_guess: result.supplier_id ? null : result.supplier_name,
      project_id: result.project_id,
      rfq_request_id: result.rfq_request_id,
      match_confidence: result.match_confidence,
      match_reason: result.match_reason,
      summary: result.summary,
      action_needed: result.action_needed,
      // Nothing to act on and nothing to check: file it as done straight away.
      status: result.action_needed || result.match_confidence === 'low' ? 'new' : 'done',
      updated_at: new Date().toISOString(),
    }).eq('id', row.id).eq('org_id', orgId)

    if (stored.length > 0) {
      await supabaseAdmin.from('agent_documents').insert(stored.map(({ a, path, uploadError }) => {
        const doc = result.documents.find(d => d.filename === a.filename)
        return {
          org_id: orgId,
          email_id: row.id,
          filename: a.filename,
          content_type: a.contentType,
          size_bytes: a.size,
          storage_path: path,
          doc_type: doc?.doc_type ?? null,
          extracted: doc ?? null,
          read_error: uploadError
            ? `Could not save the file: ${uploadError}`
            : !doc ? 'Not read' : doc.unreadable ? 'The file could not be read' : null,
        }
      }))
    }

    if (result.project_id) await syncEmailToDrive(orgId, row.id)

    if (result.action_needed) {
      await supabaseAdmin.from('org_notifications').insert({
        org_id: orgId,
        type: 'agent_action',
        title: email.fromName || email.fromEmail || 'Supplier email',
        body: result.action_needed,
        metadata: { agent_email_id: row.id, project_id: result.project_id },
      })
    }
    return 'filed'
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('agent_emails')
      .update({ status: 'error', error: message, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('org_id', orgId)
    if (stored.length > 0) {
      await supabaseAdmin.from('agent_documents').insert(stored.map(({ a, path }) => ({
        org_id: orgId,
        email_id: row.id,
        filename: a.filename,
        content_type: a.contentType,
        size_bytes: a.size,
        storage_path: path,
        read_error: `Arrived but was not read: ${message}`,
      })))
    }
    return 'failed'
  }
}

/**
 * Read an already-stored email again (its first read failed, or the filing
 * looks wrong). Works from the saved text and files.
 */
export async function retryEmail(orgId: string, emailId: string): Promise<'filed' | string> {
  const { data: row } = await supabaseAdmin
    .from('agent_emails')
    .select('id, resend_email_id, message_id, from_email, from_name, subject, received_at, body_text')
    .eq('id', emailId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!row) return 'Not found'

  const { data: docs } = await supabaseAdmin
    .from('agent_documents')
    .select('filename, content_type, size_bytes, storage_path')
    .eq('email_id', emailId)
    .eq('org_id', orgId)

  const stored: StoredAttachment[] = []
  for (const d of docs ?? []) {
    if (!d.storage_path) continue
    const { data: blob } = await supabaseAdmin.storage.from('agent-documents').download(d.storage_path)
    if (!blob) continue
    stored.push({
      a: { filename: d.filename, contentType: d.content_type ?? '', size: d.size_bytes ?? 0, content: Buffer.from(await blob.arrayBuffer()) },
      path: d.storage_path,
      uploadError: null,
    })
  }

  await supabaseAdmin.from('agent_documents').delete().eq('email_id', emailId).eq('org_id', orgId)

  const email: InboundEmail = {
    resendId: row.resend_email_id,
    messageId: row.message_id,
    recipients: [],
    fromEmail: row.from_email,
    fromName: row.from_name,
    subject: row.subject ?? '',
    receivedAt: row.received_at ? new Date(row.received_at) : null,
    text: row.body_text ?? '',
    attachments: stored.map(s => s.a),
  }
  const outcome = await readAndFile(orgId, emailId, email, stored, await loadContext(orgId))
  if (outcome === 'filed') return 'filed'
  const { data: after } = await supabaseAdmin.from('agent_emails').select('error').eq('id', emailId).eq('org_id', orgId).maybeSingle()
  return after?.error ?? 'Could not read it'
}
