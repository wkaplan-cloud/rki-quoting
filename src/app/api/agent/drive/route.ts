import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { agentGate } from '@/lib/agent/gate'
import { checkFolder, driveAccountEmail, folderIdFrom } from '@/lib/agent/drive'
import { apiError } from '@/lib/api-error'

// Connect the assistant's Drive folder. The folder is checked with Google
// before it is saved, so a link that isn't shared yet fails here rather than
// on the first PDF.
export async function PUT(req: NextRequest) {
  try {
    const gate = await agentGate()
    if (!gate.ok) return gate.res
    if (!driveAccountEmail()) return NextResponse.json({ error: 'Google Drive is not configured on the server yet' }, { status: 500 })

    const { folder } = await req.json()
    const folderId = folderIdFrom(String(folder ?? ''))
    if (!folderId) return NextResponse.json({ error: 'Paste the link of the Drive folder' }, { status: 400 })

    let checked
    try {
      checked = await checkFolder(folderId)
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `Could not open that folder. Has it been shared with ${driveAccountEmail()}? (${why})` }, { status: 400 })
    }
    if (!checked.inSharedDrive) {
      return NextResponse.json({ error: 'That folder is in someone’s My Drive. Put it in a Shared Drive — the assistant can’t save files into a personal Drive.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('agent_mailboxes')
      .update({ drive_folder_id: folderId, updated_at: new Date().toISOString() })
      .eq('org_id', gate.orgId)
    if (error) throw error
    return NextResponse.json({ ok: true, name: checked.name })
  } catch (e) {
    return apiError(e)
  }
}
