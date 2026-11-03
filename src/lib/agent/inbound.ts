import crypto from 'crypto'
import { Resend } from 'resend'

// Mail for the studio assistant arrives through Resend receiving. Two traps
// carried over from CompareMyQuotes, both of which fail silently:
//
//   The webhook is metadata only. The message has to be fetched from the
//   receiving API by its email_id.
//
//   Attachments on the fetched message are metadata only too. Each one needs
//   a second call for a short-lived download link, then the download itself.
//   Code that guesses the shape reads the quote from its covering note alone,
//   and a quote with no price looks exactly like a supplier who gave none.

export interface InboundAttachment {
  filename: string
  contentType: string
  size: number
  content: Buffer
}

export interface InboundEmail {
  resendId: string | null
  messageId: string
  /** Every address the message was delivered for, including forwarding headers. */
  recipients: string[]
  fromEmail: string | null
  fromName: string | null
  subject: string
  receivedAt: Date | null
  text: string
  attachments: InboundAttachment[]
}

let _resend: Resend | null = null
export function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/** Resend's receiving domain for this account, e.g. abcd1234.resend.app. */
export function inboundDomain(): string | null {
  return process.env.RESEND_INBOUND_DOMAIN?.trim().toLowerCase() || null
}

export function newInboundToken(): string {
  // Lowercase letters and digits only: some mail clients lowercase addresses.
  return crypto.randomBytes(8).toString('hex').slice(0, 10)
}

export function inboundAddress(agentName: string, token: string, domain: string): string {
  const name = agentName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'assistant'
  return `${name}.${token}@${domain}`
}

/** The studio's token from any recipient on our receiving domain. */
export function tokenFrom(recipients: string[], domain: string): string | null {
  for (const raw of recipients) {
    const m = raw.toLowerCase().match(/([a-z0-9.+_-]+)@([a-z0-9.-]+)/)
    if (!m || m[2] !== domain) continue
    const local = m[1].split('+')[0]
    const token = local.split('.').pop()
    if (token && /^[a-f0-9]{10}$/.test(token)) return token
  }
  return null
}

// Signature logos and social icons arrive as attachments too (an Outlook reply
// once carried 12 of them). Small images are never the document.
const READABLE = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/
const MIN_IMAGE_BYTES = 25_000
const MAX_FILES = 8
const MAX_TOTAL_BYTES = 20_000_000

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseFrom(from: string): { email: string | null; name: string | null } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() }
  return { name: null, email: from.trim().toLowerCase() || null }
}

/** Fetch a received email and its readable attachments from Resend. */
export async function fetchReceived(emailId: string): Promise<InboundEmail> {
  const { data: email, error } = await resend().emails.receiving.get(emailId)
  if (error || !email) throw new Error(`Resend could not return email ${emailId}: ${error?.message ?? 'empty'}`)

  const wanted = email.attachments
    .filter(a => READABLE.test(a.content_type) && (a.content_type === 'application/pdf' || a.size >= MIN_IMAGE_BYTES))
    // PDFs first, then the largest images: if the cap bites, it bites the decorative end.
    .sort((a, b) => Number(b.content_type === 'application/pdf') - Number(a.content_type === 'application/pdf') || b.size - a.size)

  const attachments: InboundAttachment[] = []
  let bytes = 0
  for (const a of wanted) {
    if (attachments.length >= MAX_FILES || bytes + a.size > MAX_TOTAL_BYTES) break
    const { data: link } = await resend().emails.receiving.attachments.get({ emailId, id: a.id })
    const url = (link as { download_url?: string } | null)?.download_url
    if (!url) throw new Error(`No download link for attachment ${a.filename ?? a.id}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Downloading ${a.filename ?? a.id} failed (${res.status})`)
    const content = Buffer.from(await res.arrayBuffer())
    attachments.push({ filename: a.filename || 'attachment', contentType: a.content_type, size: content.length, content })
    bytes += content.length
  }

  // A Gmail auto-forward keeps the original To (the studio's own address);
  // the assistant's address only shows in the delivery and forwarding headers.
  const headers = Object.entries(email.headers ?? {})
    .filter(([k]) => /^(x-forwarded-to|x-forwarded-for|delivered-to|x-original-to|envelope-to)$/i.test(k))
    .flatMap(([, v]) => String(v).split(/[\s,]+/))
  const recipients = [...(email.to ?? []), ...(email.cc ?? []), ...(email.bcc ?? []), ...headers]

  const from = parseFrom(email.from)
  return {
    resendId: email.id,
    messageId: email.message_id || `resend-${email.id}`,
    recipients,
    fromEmail: from.email,
    fromName: from.name,
    subject: email.subject || '(no subject)',
    receivedAt: email.created_at ? new Date(email.created_at) : null,
    text: (email.text || (email.html ? htmlToText(email.html) : '')).trim(),
    attachments,
  }
}

/**
 * Gmail sends this to a new forwarding address before it will forward to it.
 * Personal Gmail sends a code to type back in; Google Workspace sends a link
 * to open instead. Either way it is shown on the assistant's page rather than
 * read as supplier mail. Only links on Google's own settings host are kept.
 */
export function gmailForwardingRequest(email: InboundEmail): { code: string | null; link: string | null } | null {
  if (email.fromEmail !== 'forwarding-noreply@google.com') return null
  const code = (email.subject.match(/\(#(\d+)\)/) ?? email.text.match(/confirmation code:\s*(\d+)/i))?.[1] ?? null
  const link = email.text.match(/https:\/\/mail-settings\.google\.com\/mail\/vf-\S+/)?.[0] ?? null
  return code || link ? { code, link } : null
}
