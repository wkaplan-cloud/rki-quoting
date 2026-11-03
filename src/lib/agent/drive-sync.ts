import { supabaseAdmin } from '@/lib/supabase/admin'
import { moveFile, projectFolder, uploadFile } from './drive'

// Puts an email's documents in its project's Drive folder, or moves them when
// the email is refiled to another project. Safe to run again: documents
// already in the right folder are left alone. An email with no project stays
// out of Drive until someone files it. Failures are stored per document and
// shown on the assistant's page — a PDF the studio thinks is in Drive and
// isn't is worse than one it knows is missing.

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function syncEmailToDrive(orgId: string, emailId: string): Promise<void> {
  const [{ data: mailbox }, { data: email }] = await Promise.all([
    supabaseAdmin.from('agent_mailboxes').select('drive_folder_id').eq('org_id', orgId).maybeSingle(),
    supabaseAdmin
      .from('agent_emails')
      .select(`project_id, received_at, supplier_guess, suppliers(supplier_name),
        projects(project_number, project_name, clients(client_name)),
        agent_documents(id, filename, content_type, storage_path, extracted, drive_file_id, drive_parent_id)`)
      .eq('id', emailId)
      .eq('org_id', orgId)
      .maybeSingle(),
  ])
  if (!mailbox?.drive_folder_id || !email?.project_id) return

  const project = one(email.projects as unknown as { project_number: string | null; project_name: string; clients: unknown } | null)
  const client = one(project?.clients as { client_name: string } | { client_name: string }[] | null)?.client_name
  const folderName = [project?.project_number, project?.project_name].filter(Boolean).join(' ') + (client ? ` – ${client}` : '')
  const supplier = one(email.suppliers as unknown as { supplier_name: string } | null)?.supplier_name ?? email.supplier_guess

  const docs = (email.agent_documents ?? []) as {
    id: string; filename: string; content_type: string | null; storage_path: string | null
    extracted: { document_date?: string | null } | null; drive_file_id: string | null; drive_parent_id: string | null
  }[]
  if (docs.length === 0) return

  let folderId: string
  try {
    folderId = await projectFolder(mailbox.drive_folder_id, email.project_id, folderName || 'Project')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabaseAdmin.from('agent_documents').update({ drive_error: message }).eq('email_id', emailId).eq('org_id', orgId)
    return
  }

  for (const d of docs) {
    try {
      if (d.drive_file_id && d.drive_parent_id === folderId) continue
      if (d.drive_file_id && d.drive_parent_id) {
        await moveFile(d.drive_file_id, d.drive_parent_id, folderId)
        await supabaseAdmin.from('agent_documents').update({ drive_parent_id: folderId, drive_error: null }).eq('id', d.id).eq('org_id', orgId)
        continue
      }
      if (!d.storage_path) continue

      const { data: blob, error } = await supabaseAdmin.storage.from('agent-documents').download(d.storage_path)
      if (error || !blob) throw new Error(`Could not load the saved copy: ${error?.message ?? 'missing'}`)

      // "2026-10-28 da Marco – Re-Quotation.pdf": sorts by date and says who sent it.
      const date = d.extracted?.document_date || email.received_at?.slice(0, 10) || ''
      const name = [date, supplier].filter(Boolean).join(' ') + (date || supplier ? ' – ' : '') + d.filename
      const file = await uploadFile(folderId, name, d.content_type ?? '', Buffer.from(await blob.arrayBuffer()))
      await supabaseAdmin.from('agent_documents')
        .update({ drive_file_id: file.id, drive_parent_id: folderId, drive_link: file.webViewLink, drive_error: null })
        .eq('id', d.id).eq('org_id', orgId)
    } catch (e) {
      await supabaseAdmin.from('agent_documents')
        .update({ drive_error: e instanceof Error ? e.message : String(e) })
        .eq('id', d.id).eq('org_id', orgId)
    }
  }
}
