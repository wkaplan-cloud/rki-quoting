import { supabaseAdmin } from '@/lib/supabase/admin'
import { QUOTE_TYPES, INVOICE_TYPES, TYPE_LABEL, OVER_TOLERANCE, UNASSIGNED, one, norm, isoDay, dedupe, check, type Doc, type Line } from './sheet-checks'
import { accountsFolder, driveAccountEmail, fileAlive, google, taggedSheet, trashFile } from './drive'

// The assistant's "Supplier Prices" Google Sheet, in her Drive folder under
// Accounts. Every supplier quote, proforma and invoice she has read, journalled
// per client.
//
// The sheet is a mirror, never a source: each run rebuilds every tab from
// agent_documents in one atomic batchUpdate, so a refiled email moves, nothing
// is appended twice, and anything typed into the sheet is overwritten. The
// figures are what the model read off the PDFs — for reference, never fed
// back into quotes or line items.

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEET_NAME = 'Supplier Prices'

// Fixed tab ids, so a renamed tab is still found and a deleted one comes back.
const TABS = [
  { id: 101, title: 'Journal' },
  { id: 102, title: 'Lines' },
  { id: 103, title: 'By client' },
  { id: 104, title: 'About' },
] as const

// ── Data ──────────────────────────────────────────────────────────────────

interface Extracted {
  supplier_name?: string | null
  reference?: string | null
  document_date?: string | null
  valid_until?: string | null
  client_or_project_reference?: string | null
  currency?: string | null
  subtotal_excl_vat?: number | null
  vat?: number | null
  total_incl_vat?: number | null
  lines?: Line[] | null
}

async function loadDocs(orgId: string): Promise<Doc[]> {
  const rows: Record<string, unknown>[] = []
  // PostgREST caps a response at 1000 rows.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('agent_documents')
      .select(`id, doc_type, extracted, drive_link, created_at,
        agent_emails!inner(received_at, project_id, supplier_guess, match_confidence,
          suppliers(supplier_name), projects(project_number, project_name, clients(client_name)))`)
      .eq('org_id', orgId)
      .in('doc_type', [...QUOTE_TYPES, ...INVOICE_TYPES])
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`Could not load documents: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  return rows.map(r => {
    const e = one<Record<string, unknown>>(r.agent_emails as Record<string, unknown>)!
    const x = (r.extracted ?? {}) as Extracted
    const project = one(e.projects as { project_number: string | null; project_name: string; clients: unknown } | null)
    const client = one(project?.clients as { client_name: string } | null)?.client_name
    const supplier = one(e.suppliers as { supplier_name: string } | null)?.supplier_name
      ?? (e.supplier_guess as string | null) ?? x.supplier_name ?? 'Unknown supplier'
    const incl = x.total_incl_vat ?? null
    const vat = x.vat ?? null
    const docType = r.doc_type as string
    return {
      id: r.id as string,
      side: INVOICE_TYPES.includes(docType) ? 'invoice' : 'quote',
      docType,
      received: isoDay(e.received_at as string | null) ?? isoDay(r.created_at as string)!,
      docDate: isoDay(x.document_date),
      projectId: (e.project_id as string | null) ?? null,
      client: project ? client ?? project.project_name : UNASSIGNED,
      project: project ? [project.project_number, project.project_name].filter(Boolean).join(' ') : '',
      supplier,
      supplierKey: norm(supplier),
      ref: x.reference?.trim() || null,
      excl: x.subtotal_excl_vat ?? (incl != null && vat != null ? incl - vat : null),
      vat,
      incl,
      currency: (x.currency || 'ZAR').toUpperCase(),
      validUntil: isoDay(x.valid_until),
      printedClient: x.client_or_project_reference?.trim() || null,
      link: (r.drive_link as string | null) ?? null,
      unsure: !!project && e.match_confidence === 'low',
      copies: 1,
      lines: (x.lines ?? []).map(l => ({ ...l })),
      checks: [],
    } satisfies Doc
  })
}

/** Every priced document for the studio, de-duplicated and checked. Read-only. */
export async function prepareDocs(orgId: string, today: string): Promise<Doc[]> {
  const docs = dedupe(await loadDocs(orgId))
  check(docs, today)
  return docs
}

// ── Cells ─────────────────────────────────────────────────────────────────

type Cell = Record<string, unknown>

const COLOURS = {
  header: { red: 0.93, green: 0.914, blue: 0.882 },
  group: { red: 0.965, green: 0.957, blue: 0.937 },
  bad: { red: 0.973, green: 0.843, blue: 0.812 },
  warn: { red: 0.988, green: 0.922, blue: 0.769 },
  good: { red: 0.867, green: 0.937, blue: 0.851 },
}

const text = (v: string | null | undefined, fmt: Cell = {}): Cell =>
  ({ userEnteredValue: { stringValue: v ?? '' }, userEnteredFormat: fmt })

function num(v: number | null | undefined, currency = 'ZAR', fmt: Cell = {}): Cell {
  if (v == null || !Number.isFinite(v)) return text('', fmt)
  const pattern = currency === 'ZAR' ? '"R" #,##0.00' : `"${currency.replace(/"/g, '')} " #,##0.00`
  return { userEnteredValue: { numberValue: Math.round(v * 100) / 100 }, userEnteredFormat: { ...fmt, numberFormat: { type: 'NUMBER', pattern } } }
}

function count(v: number, fmt: Cell = {}): Cell {
  return { userEnteredValue: { numberValue: v }, userEnteredFormat: fmt }
}

/** A real date, so the column sorts and filters by date. */
function day(iso: string | null): Cell {
  if (!iso) return text('')
  const [y, m, d] = iso.split('-').map(Number)
  const serial = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
  return { userEnteredValue: { numberValue: serial }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd mmm yyyy' } } }
}

function link(url: string | null, label: string): Cell {
  if (!url) return text('')
  return { userEnteredValue: { formulaValue: `=HYPERLINK("${url.replace(/"/g, '%22')}","${label}")` } }
}

const bold = { textFormat: { bold: true } }
const header = (titles: string[]): Cell[] =>
  titles.map(t => text(t, { textFormat: { bold: true }, backgroundColor: COLOURS.header }))

function checkCell(checks: Doc['checks']): Cell {
  if (!checks.length) return text('')
  const level = checks.some(c => c.level === 'bad') ? 'bad' : checks.some(c => c.level === 'warn') ? 'warn' : 'good'
  return text(checks.map(c => c.text).join('; '), { backgroundColor: COLOURS[level] })
}

// ── Tabs ──────────────────────────────────────────────────────────────────

const byClient = (a: Doc, b: Doc) =>
  Number(a.client === UNASSIGNED) - Number(b.client === UNASSIGNED) || a.client.localeCompare(b.client) || a.project.localeCompare(b.project)

function journalRows(docs: Doc[]): Cell[][] {
  const rows = [...docs].sort((a, b) => b.received.localeCompare(a.received) || byClient(a, b))
  return [
    header(['Received', 'Doc date', 'Client', 'Project', 'Supplier', 'Type', 'Number', 'Excl VAT', 'VAT', 'Incl VAT', 'Valid until', 'Check', 'Client ref on document', 'PDF']),
    ...rows.map(d => [
      day(d.received), day(d.docDate), text(d.client), text(d.project), text(d.supplier), text(TYPE_LABEL[d.docType] ?? d.docType),
      text(d.ref), num(d.excl, d.currency), num(d.vat, d.currency), num(d.incl, d.currency), day(d.validUntil),
      checkCell(d.checks), text(d.printedClient), link(d.link, 'Open'),
    ]),
  ]
}

function lineRows(docs: Doc[]): Cell[][] {
  const rows = [...docs].sort((a, b) => byClient(a, b) || a.supplier.localeCompare(b.supplier) || a.received.localeCompare(b.received))
  const out: Cell[][] = [
    header(['Received', 'Client', 'Project', 'Supplier', 'Type', 'Number', 'Code', 'Item', 'Qty', 'Unit', 'Unit price', 'Line total', 'Quoted unit price', 'Difference', 'Quote']),
  ]
  for (const d of rows) {
    for (const l of d.lines) {
      const diff = l.unit_price != null && l.quoted != null ? l.unit_price - l.quoted : null
      const over = diff != null && l.quoted != null && diff > Math.max(0.01, l.quoted * OVER_TOLERANCE)
      out.push([
        day(d.received), text(d.client), text(d.project), text(d.supplier), text(TYPE_LABEL[d.docType] ?? d.docType), text(d.ref),
        text(l.code), text(l.description), l.quantity == null ? text('') : count(l.quantity), text(l.unit),
        num(l.unit_price, d.currency), num(l.line_total, d.currency), num(l.quoted, d.currency),
        num(diff, d.currency, over ? { backgroundColor: COLOURS.bad } : {}), text(l.quoteRef),
      ])
    }
  }
  return out
}

/** One block per client and project: what each supplier quoted, and what they invoiced. */
function clientRows(docs: Doc[], today: string): Cell[][] {
  const out: Cell[][] = [
    header(['Supplier', 'Quotes', 'Quoted excl VAT', 'Invoices', 'Invoiced excl VAT', 'Invoiced − quoted', 'Latest quote', 'Valid until']),
  ]
  const groups = new Map<string, Doc[]>()
  for (const d of [...docs].sort(byClient)) {
    const key = d.projectId ?? UNASSIGNED
    groups.set(key, [...(groups.get(key) ?? []), d])
  }

  for (const list of groups.values()) {
    const first = list[0]
    const title = first.client === UNASSIGNED ? 'Unassigned — file these to a project on the assistant page' : [first.client, first.project].filter(Boolean).join(' — ')
    out.push([text(title, { textFormat: { bold: true }, backgroundColor: COLOURS.group }), ...Array(7).fill(text('', { backgroundColor: COLOURS.group }))])

    const suppliers = new Map<string, Doc[]>()
    for (const d of list) {
      const key = `${d.supplierKey}|${d.currency}`
      suppliers.set(key, [...(suppliers.get(key) ?? []), d])
    }
    const totals = new Map<string, { quoted: number; invoiced: number }>()
    for (const sd of [...suppliers.values()].sort((a, b) => a[0].supplier.localeCompare(b[0].supplier))) {
      const cur = sd[0].currency
      const quotes = sd.filter(d => d.side === 'quote')
      const invoices = sd.filter(d => d.side === 'invoice')
      const quoted = quotes.reduce((t, d) => t + (d.excl ?? 0), 0)
      const invoiced = invoices.reduce((t, d) => t + (d.excl ?? 0), 0)
      const latest = [...quotes].sort((a, b) => b.received.localeCompare(a.received))[0]
      const over = quotes.length > 0 && invoiced - quoted > 0.01
      const expired = latest?.validUntil && latest.validUntil < today
      out.push([
        text(sd[0].supplier), count(quotes.length), quotes.length ? num(quoted, cur) : text(''),
        count(invoices.length), invoices.length ? num(invoiced, cur) : text(''),
        quotes.length && invoices.length ? num(invoiced - quoted, cur, over ? { backgroundColor: COLOURS.bad } : {}) : text(''),
        text(latest?.ref ?? (latest ? latest.received : '')),
        latest?.validUntil ? { ...day(latest.validUntil), ...(expired ? { userEnteredFormat: { backgroundColor: COLOURS.warn, numberFormat: { type: 'DATE', pattern: 'd mmm yyyy' } } } : {}) } : text(''),
      ])
      const t = totals.get(cur) ?? { quoted: 0, invoiced: 0 }
      totals.set(cur, { quoted: t.quoted + quoted, invoiced: t.invoiced + invoiced })
    }
    for (const [cur, t] of totals) {
      out.push([
        text(totals.size > 1 ? `Total (${cur})` : 'Total', bold), text(''), num(t.quoted, cur, bold), text(''), num(t.invoiced, cur, bold),
        text(''), text(''), text(''),
      ])
    }
    out.push([])
  }
  return out
}

function aboutRows(name: string, docs: Doc[]): Cell[][] {
  const stamp = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' })
  return [
    [text(SHEET_NAME, { textFormat: { bold: true, fontSize: 14 } })],
    [text(`Kept by ${name} in QuotingHub. Last rebuilt ${stamp} (SAST), ${docs.length} documents.`)],
    [],
    [text(`Do not type in this sheet. It is rebuilt from QuotingHub after every email, so changes made here are lost. To fix a client or supplier, refile the email on ${name}’s page in QuotingHub.`)],
    [text('Figures are read off the PDFs by AI and are not checked. Check against the PDF before paying or quoting.')],
    [],
    [text('Journal', bold), text('One row per quote, proforma or invoice, newest first. Use the filter on the header row to show one client or supplier.')],
    [text('Lines', bold), text('Every line item. On invoices, "Quoted unit price" is the same item on the supplier’s earlier quote; red means invoiced above the quote.')],
    [text('By client', bold), text('Per client and project: what each supplier quoted and invoiced, excl VAT. Proformas count as quotes, because the invoice for the same goods usually follows.')],
    [],
    [text('Check column', bold), text('Red: invoiced above the quote. Amber: quote expired, the same document received more than once, or the project is not certain. Green: invoice matches the quote.')],
    [text('Unassigned', bold), text('Documents not yet filed to a project. Their PDF link appears once they are filed.')],
  ]
}

// ── Writing ───────────────────────────────────────────────────────────────

function widthOf(rows: Cell[][]): number {
  return Math.max(1, ...rows.map(r => r.length))
}

function tabRequests(tabId: number, rows: Cell[][], opts: { frozen: number; filter: boolean }): object[] {
  const columns = widthOf(rows)
  return [
    {
      updateSheetProperties: {
        properties: { sheetId: tabId, gridProperties: { rowCount: Math.max(rows.length + 50, 100), columnCount: Math.max(columns, 8), frozenRowCount: opts.frozen } },
        fields: 'gridProperties(rowCount,columnCount,frozenRowCount)',
      },
    },
    // An open-ended range: every cell past the new data is cleared, in the same atomic call.
    {
      updateCells: {
        range: { sheetId: tabId, startRowIndex: 0, startColumnIndex: 0 },
        rows: rows.map(values => ({ values })),
        fields: 'userEnteredValue,userEnteredFormat',
      },
    },
    opts.filter
      ? { setBasicFilter: { filter: { range: { sheetId: tabId, startRowIndex: 0, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: columns } } } }
      : { clearBasicFilter: { sheetId: tabId } },
    { autoResizeDimensions: { dimensions: { sheetId: tabId, dimension: 'COLUMNS', startIndex: 0, endIndex: columns } } },
  ]
}

async function ensureSheet(orgId: string, rootFolderId: string, current: string | null): Promise<string> {
  if (current && (await fileAlive(current))) return current

  const id = await taggedSheet(await accountsFolder(rootFolderId), 'supplier-prices', SHEET_NAME)
  if (id === current) return id
  // Two emails filed at once can both create the sheet; the first one saved wins.
  const query = supabaseAdmin.from('agent_mailboxes').update({ sheet_id: id }).eq('org_id', orgId)
  const { data } = await (current ? query.eq('sheet_id', current) : query.is('sheet_id', null)).select('sheet_id')
  if (data?.length) return id
  const { data: winner } = await supabaseAdmin.from('agent_mailboxes').select('sheet_id').eq('org_id', orgId).maybeSingle()
  if (winner?.sheet_id && winner.sheet_id !== id) {
    await trashFile(id).catch(() => {})
    return winner.sheet_id
  }
  return id
}

async function writeSheet(sheetId: string, tabs: { id: number; rows: Cell[][]; frozen: number; filter: boolean }[]): Promise<void> {
  const meta = await google<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${SHEETS}/${sheetId}?fields=sheets.properties(sheetId,title)`,
  )
  const have = new Set(meta.sheets.map(s => s.properties.sheetId))
  const titles = new Set(meta.sheets.map(s => s.properties.title))

  const setup: object[] = []
  TABS.forEach((t, index) => {
    if (have.has(t.id)) return
    // Someone made their own tab with this name: ours gets a suffix rather than failing.
    const title = titles.has(t.title) ? `${t.title} (Mia)` : t.title
    setup.push({ addSheet: { properties: { sheetId: t.id, title, index } } })
    // A warning, not a lock: people can still edit, but are told it will be overwritten.
    setup.push({ addProtectedRange: { protectedRange: { range: { sheetId: t.id }, warningOnly: true, description: 'Rebuilt from QuotingHub — edits here are overwritten' } } })
  })
  // The blank tab Google makes with a new spreadsheet.
  const blank = meta.sheets.find(s => s.properties.sheetId === 0 && /^(Sheet1|Blad1)$/.test(s.properties.title))
  if (blank && setup.length) setup.push({ deleteSheet: { sheetId: 0 } })

  const requests = [...setup, ...tabs.flatMap(t => tabRequests(t.id, t.rows, t))]
  await google(`${SHEETS}/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  })
}

export function sheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
}

/**
 * Rebuild the studio's Supplier Prices sheet. Never throws: the outcome is
 * stored on the mailbox (sheet_synced_at / sheet_error) and shown on the
 * assistant's page, so a filing never fails because Google did.
 */
export async function syncSheet(orgId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { data: mailbox } = await supabaseAdmin
    .from('agent_mailboxes')
    .select('agent_name, drive_folder_id, sheet_id')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!mailbox) return { ok: false, error: 'The assistant is not set up' }
  if (!driveAccountEmail() || !mailbox.drive_folder_id) return { ok: false, error: 'Connect a Google Drive folder first' }

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' })
    const docs = await prepareDocs(orgId, today)

    const sheetId = await ensureSheet(orgId, mailbox.drive_folder_id, mailbox.sheet_id)
    await writeSheet(sheetId, [
      { id: 101, rows: journalRows(docs), frozen: 1, filter: true },
      { id: 102, rows: lineRows(docs), frozen: 1, filter: true },
      { id: 103, rows: clientRows(docs, today), frozen: 1, filter: false },
      { id: 104, rows: aboutRows(mailbox.agent_name, docs), frozen: 0, filter: false },
    ])
    await supabaseAdmin.from('agent_mailboxes')
      .update({ sheet_id: sheetId, sheet_synced_at: new Date().toISOString(), sheet_error: null })
      .eq('org_id', orgId)
    return { ok: true, url: sheetUrl(sheetId) }
  } catch (e) {
    let error = e instanceof Error ? e.message : String(e)
    if (/Sheets API has not been used|sheets\.googleapis\.com.*disabled|SERVICE_DISABLED/i.test(error)) {
      error = 'The Google Sheets API is switched off for the assistant’s Google Cloud project. Turn it on, then press Update.'
    }
    await supabaseAdmin.from('agent_mailboxes').update({ sheet_error: error }).eq('org_id', orgId)
    return { ok: false, error }
  }
}
