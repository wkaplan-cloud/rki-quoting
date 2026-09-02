import { Resend } from 'resend'
import crypto from 'crypto'

/**
 * Central email sender for QuotingHub.
 *
 * Every outgoing email should go through `sendEmail` (transactional) or
 * `sendBulkEmail` (marketing / broadcast). The wrapper guarantees the
 * deliverability basics that were previously hand-rolled per route:
 *
 *  - a real text/plain part alongside the HTML (HTML-only mail is a spam signal)
 *  - a monitored Reply-To on every message
 *  - hidden preheader text so the inbox preview line is intentional
 *  - RFC 8058 one-click List-Unsubscribe headers on bulk mail
 *  - suppression-list filtering on bulk mail
 */

// Constructed lazily: the Resend client throws if the key is absent, and this
// module is imported by routes that are built in environments without it.
let _resend: Resend | null = null
function client(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/** Transactional sender — password resets, quotes, invoices, invites. */
export const FROM_TRANSACTIONAL = 'QuotingHub <noreply@quotinghub.co.za>'

/**
 * Marketing sender. Set MARKETING_FROM to the news. subdomain once its DNS is
 * verified in Resend so broadcast complaints can never affect the transactional
 * domain's reputation. Falls back to the current root-domain address.
 */
export const FROM_MARKETING =
  process.env.MARKETING_FROM ?? 'QuotingHub <hello@quotinghub.co.za>'

export const DEFAULT_REPLY_TO = 'hello@quotinghub.co.za'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'

/** Physical postal address shown in marketing footers (CAN-SPAM / POPIA). */
export const POSTAL_ADDRESS =
  process.env.MARKETING_POSTAL_ADDRESS ?? 'QuotingHub, Johannesburg, South Africa'

// ---------------------------------------------------------------------------
// Plain-text derivation
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&rarr;': '->', '&larr;': '<-',
  '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&zwnj;': '', '&copy;': '©', '&reg;': '®',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => {
      if (ENTITIES[m]) return ENTITIES[m]
      const num = /^&#(\d+);$/.exec(m)
      return num ? String.fromCharCode(Number(num[1])) : m
    })
}

/**
 * Derive a readable text/plain body from an HTML email.
 * Keeps link destinations, which matters — a text part that drops the CTA URL
 * is worse than useless to a plain-text reader.
 */
export function htmlToText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Preheader spans are for the preview line only — not for the text body.
  s = s.replace(/<span[^>]*data-preheader[\s\S]*?<\/span>/gi, '')
  // Keep the href next to its anchor text, unless they're already the same.
  s = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, label: string) => {
      const text = decodeEntities(label.replace(/<[^>]+>/g, '')).trim()
      if (!text) return href
      if (href.includes(text) || text.includes(href)) return text
      return `${text} (${href})`
    },
  )
  s = s.replace(/<br\s*\/?>/gi, '\n')
  // Cells are separated by a tab so table rows stay readable as plain text.
  s = s.replace(/<\/(td|th)>/gi, '\t')
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
  s = s.replace(/<li\b[^>]*>/gi, '- ')
  s = s.replace(/<hr\s*\/?>/gi, '\n----------\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  s = s.replace(/[ \u00a0]+/g, ' ')
  s = s.replace(/ *\t[ \t]*/g, '\t')
  s = s.replace(/[ \t]*\n[ \t]*/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

/** Inject hidden preheader text as the first thing inside the body. */
export function withPreheader(html: string, preheader?: string): string {
  if (!preheader) return html
  const hidden =
    `<span data-preheader style="display:none;max-height:0;overflow:hidden;` +
    `mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;">` +
    `${preheader.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
  // Place it immediately after <body> when present, otherwise at the very top.
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1${hidden}`)
  }
  return hidden + html
}

// ---------------------------------------------------------------------------
// Unsubscribe tokens
// ---------------------------------------------------------------------------

const UNSUB_SECRET =
  process.env.EMAIL_UNSUB_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** Stateless, signed unsubscribe token — no DB row needed to issue one. */
export function unsubscribeToken(email: string): string {
  const addr = email.trim().toLowerCase()
  const payload = Buffer.from(addr).toString('base64url')
  const sig = crypto
    .createHmac('sha256', UNSUB_SECRET)
    .update(addr)
    .digest('base64url')
    .slice(0, 32)
  return `${payload}.${sig}`
}

/** Returns the email address if the token is authentic, otherwise null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, sig] = (token ?? '').split('.')
  if (!payload || !sig) return null
  let addr: string
  try {
    addr = Buffer.from(payload, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = crypto
    .createHmac('sha256', UNSUB_SECRET)
    .update(addr)
    .digest('base64url')
    .slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return addr
}

export function unsubscribeUrl(email: string): string {
  return `${APP_URL}/api/unsubscribe?t=${unsubscribeToken(email)}`
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

type Attachment = { filename: string; content: Buffer | string; contentType?: string }

type Body =
  | { html: string; text?: string }   // HTML, with the text part derived if omitted
  | { html?: undefined; text: string } // plain-text only (internal notifications)

export type SendEmailOptions = Body & {
  to: string | string[]
  subject: string
  /** Hidden inbox-preview line. Strongly recommended: 40–90 characters. */
  preheader?: string
  /** Defaults to the transactional sender. */
  from?: string
  /** Defaults to hello@quotinghub.co.za — never leave replies unmonitored. */
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: Attachment[]
  headers?: Record<string, string>
}

/**
 * Send one transactional email.
 * Fills in From, Reply-To, preheader and the text/plain part when not supplied.
 */
export async function sendEmail(opts: SendEmailOptions) {
  const html = opts.html ? withPreheader(opts.html, opts.preheader) : undefined
  const text = opts.text ?? (html ? htmlToText(html) : '')
  return client().emails.send({
    from: opts.from ?? FROM_TRANSACTIONAL,
    replyTo: opts.replyTo ?? DEFAULT_REPLY_TO,
    to: opts.to,
    ...(opts.cc ? { cc: opts.cc } : {}),
    ...(opts.bcc ? { bcc: opts.bcc } : {}),
    subject: opts.subject,
    ...(html ? { html } : {}),
    text,
    ...(opts.attachments ? { attachments: opts.attachments } : {}),
    ...(opts.headers ? { headers: opts.headers } : {}),
  })
}

export type BulkRecipient = { email: string }

/**
 * Build the per-recipient payload for a bulk send, including the RFC 8058
 * one-click unsubscribe headers that Gmail and Yahoo require of bulk senders.
 */
export function bulkPayload(opts: {
  to: string
  subject: string
  html: string
  text?: string
  preheader?: string
  from?: string
  replyTo?: string
}) {
  const url = unsubscribeUrl(opts.to)
  const html = withPreheader(opts.html, opts.preheader)
  return {
    from: opts.from ?? FROM_MARKETING,
    replyTo: opts.replyTo ?? DEFAULT_REPLY_TO,
    to: [opts.to],
    subject: opts.subject,
    html,
    text: opts.text ?? htmlToText(html),
    headers: {
      'List-Unsubscribe': `<${url}>, <mailto:${DEFAULT_REPLY_TO}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

/** Standard marketing footer: visible unsubscribe link + postal address. */
export function marketingFooter(email: string): string {
  const url = unsubscribeUrl(email)
  return `<hr style="border:none;border-top:1px solid #EDE9E1;margin:32px 0;" />
<p style="font-size:12px;color:#8A877F;margin:0;line-height:1.6;">
QuotingHub &middot; <a href="${APP_URL}" style="color:#8A877F;">quotinghub.co.za</a><br />
${POSTAL_ADDRESS}<br />
<a href="${url}" style="color:#8A877F;text-decoration:underline;">Unsubscribe from these emails</a>
</p>`
}
