import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

// Reads the assistant's own Gmail inbox over IMAP with a Google app password.
// Progress is tracked by IMAP UID, so nothing here marks mail as read or moves
// it — whoever opens the Gmail account sees it exactly as it arrived.

export interface MailboxLogin {
  email: string
  appPassword: string
}

export interface InboundAttachment {
  filename: string
  contentType: string
  size: number
  content: Buffer
}

export interface InboundEmail {
  uid: number
  messageId: string
  fromEmail: string | null
  fromName: string | null
  subject: string
  receivedAt: Date | null
  text: string
  attachments: InboundAttachment[]
}

export interface FetchResult {
  uidValidity: number
  emails: InboundEmail[]
  /** Highest UID looked at, even if it held nothing worth keeping. */
  lastUid: number | null
}

/** How far back the very first run looks, so connecting doesn't read years of mail. */
const FIRST_RUN_DAYS = 14

function client(login: MailboxLogin) {
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: login.email, pass: login.appPassword.replace(/\s+/g, '') },
    logger: false,
  })
}

/** Logs in and out. Throws with Gmail's own message when the login is refused. */
export async function testLogin(login: MailboxLogin): Promise<void> {
  const imap = client(login)
  await imap.connect()
  await imap.logout()
}

// Signature logos and social icons arrive as attachments too (an Outlook reply
// once carried 12 of them). Small images are never the document.
const MIN_IMAGE_BYTES = 25_000

function keepAttachment(a: InboundAttachment): boolean {
  if (a.contentType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')) return true
  if (a.contentType.startsWith('image/')) return a.size >= MIN_IMAGE_BYTES
  return false
}

/**
 * New mail since `afterUid`. When the mailbox's UIDVALIDITY has changed (or
 * this is the first run), UIDs are meaningless, so it falls back to the last
 * FIRST_RUN_DAYS days and relies on message-id de-duplication downstream.
 */
export async function fetchNewMail(
  login: MailboxLogin,
  opts: { afterUid: number | null; uidValidity: number | null; limit: number },
): Promise<FetchResult> {
  const imap = client(login)
  await imap.connect()
  try {
    const lock = await imap.getMailboxLock('INBOX', { readOnly: true })
    try {
      const mailbox = imap.mailbox
      if (!mailbox) throw new Error('Inbox could not be opened')
      const uidValidity = Number(mailbox.uidValidity)
      const fresh = opts.afterUid == null || opts.uidValidity !== uidValidity

      let uids: number[]
      if (fresh) {
        const since = new Date(Date.now() - FIRST_RUN_DAYS * 86400000)
        uids = (await imap.search({ since }, { uid: true })) || []
      } else {
        uids = (await imap.search({ uid: `${opts.afterUid! + 1}:*` }, { uid: true })) || []
        // "n:*" always returns the newest message even when n is past it.
        uids = uids.filter(u => u > opts.afterUid!)
      }
      uids.sort((a, b) => a - b)
      const batch = uids.slice(0, opts.limit)
      if (batch.length === 0) return { uidValidity, emails: [], lastUid: fresh ? null : opts.afterUid }

      const emails: InboundEmail[] = []
      for await (const msg of imap.fetch(batch.join(','), { uid: true, source: true, internalDate: true }, { uid: true })) {
        if (!msg.source) continue
        const parsed = await simpleParser(msg.source)
        const from = parsed.from?.value?.[0]
        const attachments = parsed.attachments
          .map(a => ({
            filename: a.filename || 'attachment',
            contentType: (a.contentType || '').toLowerCase(),
            size: a.size ?? a.content.length,
            content: a.content,
          }))
          .filter(keepAttachment)

        emails.push({
          uid: msg.uid,
          messageId: parsed.messageId || `uid-${uidValidity}-${msg.uid}`,
          fromEmail: from?.address?.toLowerCase() ?? null,
          fromName: from?.name || null,
          subject: parsed.subject || '(no subject)',
          receivedAt: parsed.date ?? (msg.internalDate ? new Date(msg.internalDate) : null),
          text: (parsed.text || '').trim(),
          attachments,
        })
      }
      return { uidValidity, emails, lastUid: batch[batch.length - 1] }
    } finally {
      lock.release()
    }
  } finally {
    await imap.logout().catch(() => {})
  }
}
