import { JWT } from 'google-auth-library'

// The studio assistant's Google Drive access: a service account the studio
// shares one folder with (in a Shared Drive — a service account has no
// storage of its own, so it can't save into anyone's personal My Drive).
//
// Inside that folder the assistant keeps one subfolder per QuotingHub
// project. Each subfolder is tagged with the project id (appProperties), so
// a folder someone renames is still found, and no folder list is kept in the
// database to drift out of step with Drive.

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const FOLDER = 'application/vnd.google-apps.folder'
// Every call names Shared Drives explicitly or Drive answers as if they don't exist.
const ALL_DRIVES = 'supportsAllDrives=true'

interface ServiceAccount { client_email: string; private_key: string }

function account(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    return parsed.client_email && parsed.private_key ? parsed : null
  } catch {
    return null
  }
}

/** The address the studio shares its folder with, or null when Drive isn't configured. */
export function driveAccountEmail(): string | null {
  return account()?.client_email ?? null
}

let _jwt: JWT | null = null
async function token(): Promise<string> {
  const sa = account()
  if (!sa) throw new Error('Google Drive is not configured on the server (GOOGLE_SERVICE_ACCOUNT_JSON)')
  if (!_jwt) _jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive'] })
  const { token: t } = await _jwt.getAccessToken()
  if (!t) throw new Error('Google did not issue a Drive token')
  return t
}

async function drive<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...init.headers } })
  if (!res.ok) {
    const body = await res.text()
    let message = body.slice(0, 300)
    try { message = JSON.parse(body).error?.message ?? message } catch {}
    throw new Error(`Google Drive ${res.status}: ${message}`)
  }
  return res.json() as Promise<T>
}

/** A folder id from a pasted Drive link, or the id itself. */
export function folderIdFrom(input: string): string | null {
  const s = input.trim()
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null
}

/** Checks the folder exists, is shared with the assistant, and can take new files. */
export async function checkFolder(folderId: string): Promise<{ name: string; inSharedDrive: boolean }> {
  const f = await drive<{ name: string; mimeType: string; driveId?: string; capabilities?: { canAddChildren?: boolean } }>(
    `${API}/files/${folderId}?fields=name,mimeType,driveId,capabilities(canAddChildren)&${ALL_DRIVES}`,
  )
  if (f.mimeType !== FOLDER) throw new Error('That link is a file, not a folder')
  if (!f.capabilities?.canAddChildren) throw new Error('The folder is shared view-only; share it as Content manager or Editor')
  return { name: f.name, inSharedDrive: !!f.driveId }
}

function clean(name: string): string {
  return name.replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

/** The project's subfolder inside the assistant's folder, created the first time it's needed. */
export async function projectFolder(rootId: string, projectId: string, name: string): Promise<string> {
  const q = `'${rootId}' in parents and mimeType='${FOLDER}' and trashed=false and appProperties has { key='qhProjectId' and value='${projectId}' }`
  const found = await drive<{ files: { id: string }[] }>(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&includeItemsFromAllDrives=true&${ALL_DRIVES}`,
  )
  if (found.files[0]) return found.files[0].id

  const made = await drive<{ id: string }>(`${API}/files?fields=id&${ALL_DRIVES}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: clean(name), mimeType: FOLDER, parents: [rootId], appProperties: { qhProjectId: projectId } }),
  })
  return made.id
}

export async function uploadFile(parentId: string, name: string, contentType: string, content: Buffer): Promise<{ id: string; webViewLink: string }> {
  const boundary = `qh${Date.now().toString(36)}`
  const meta = JSON.stringify({ name: clean(name), parents: [parentId] })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  return drive(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink&${ALL_DRIVES}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
}

export async function moveFile(fileId: string, fromId: string, toId: string): Promise<void> {
  await drive(`${API}/files/${fileId}?addParents=${toId}&removeParents=${fromId}&fields=id&${ALL_DRIVES}`, { method: 'PATCH' })
}
