'use client'
import { useState } from 'react'
import { X, Upload, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: 'var(--qh-accent)',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7', input: '#F4F4F5',
  danger: '#DC2626', green: '#16A34A',
}

type Field = 'description' | 'cost' | 'sku' | 'brand' | 'category' | 'unit'

const FIELDS: { key: Field; label: string; required?: boolean; guesses: RegExp }[] = [
  { key: 'description', label: 'Description', required: true, guesses: /desc|product|item name|name/i },
  { key: 'cost',        label: 'Cost price',  required: true, guesses: /cost|dealer|trade|nett|net price|price/i },
  { key: 'sku',         label: 'SKU / code',  guesses: /sku|code|part|model|stock/i },
  { key: 'brand',       label: 'Brand',       guesses: /brand|make|manufacturer/i },
  { key: 'category',    label: 'Category',    guesses: /categ|group|range|type/i },
  { key: 'unit',        label: 'Unit',        guesses: /^unit$|uom/i },
]

/** "R 1 234,50" / "1,234.50" / "1234.5" → 1234.5 */
function parseMoney(v: unknown): number {
  if (typeof v === 'number') return v
  let s = String(v ?? '').replace(/[^0-9.,-]/g, '')
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  return parseFloat(s)
}

function guessMapping(headers: string[]): Record<Field, number> {
  const map = {} as Record<Field, number>
  const taken = new Set<number>()
  for (const f of FIELDS) {
    const idx = headers.findIndex((h, i) => !taken.has(i) && f.guesses.test(h))
    map[f.key] = idx
    if (idx >= 0) taken.add(idx)
  }
  return map
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export function CatalogueImport({ onClose, onImported }: Props) {
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<unknown[][]>([])
  const [mapping, setMapping] = useState<Record<Field, number> | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [markup, setMarkup] = useState('30')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number } | null>(null)

  async function handleFile(file: File) {
    setParsing(true); setError(''); setResult(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
      // Distributor sheets often open with a title block; the header is the
      // first row that fills at least three cells.
      const headerIdx = all.findIndex(r => r.filter(c => String(c).trim() !== '').length >= 3)
      if (headerIdx < 0) throw new Error('Could not find a header row in that file.')
      const hdrs = all[headerIdx].map(c => String(c).trim())
      setHeaders(hdrs)
      setDataRows(all.slice(headerIdx + 1))
      setMapping(guessMapping(hdrs))
      setFileName(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file')
      setHeaders([]); setDataRows([]); setMapping(null)
    } finally {
      setParsing(false)
    }
  }

  const mapped = mapping
    ? dataRows.map(r => {
        const pick = (f: Field) => (mapping[f] >= 0 ? String(r[mapping[f]] ?? '').trim() : '')
        return {
          description: pick('description'),
          cost: parseMoney(mapping.cost >= 0 ? r[mapping.cost] : ''),
          sku: pick('sku') || null,
          brand: pick('brand') || null,
          category: pick('category') || null,
          unit: pick('unit') || null,
        }
      })
    : []
  const valid = mapped.filter(r => r.description && Number.isFinite(r.cost) && r.cost >= 0)
  const markupNum = parseFloat(markup)
  const canImport = !!mapping && mapping.description >= 0 && mapping.cost >= 0 && valid.length > 0 && !importing

  async function handleImport() {
    if (!canImport) return
    setImporting(true); setError('')
    try {
      const res = await fetch('/api/supplier-portal/quoting/item-library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: valid,
          markup_percent: Number.isFinite(markupNum) ? markupNum : null,
          supplier_name: supplierName.trim() || null,
        }),
      })
      const d = await res.json() as { added?: number; updated?: number; skipped?: number; error?: string }
      if (!res.ok) { setError(d.error ?? 'Import failed'); return }
      setResult({ added: d.added ?? 0, updated: d.updated ?? 0, skipped: (d.skipped ?? 0) + (mapped.length - valid.length) })
      onImported()
    } catch {
      setError('Import failed — check your connection and try again')
    } finally {
      setImporting(false)
    }
  }

  const fmtR = (n: number) => 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const labelCls = 'block text-[10px] font-semibold uppercase tracking-wider mb-1'
  const inputStyle = { background: S.input, border: `1px solid ${S.border}`, color: S.text }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget && !importing) onClose() }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
          <div>
            <h2 className="font-bold text-sm" style={{ color: S.text }}>Import price list</h2>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>CSV or Excel from your distributor. Re-importing updates prices — nothing is duplicated.</p>
          </div>
          <button onClick={onClose} disabled={importing} className="p-1.5 rounded-lg" style={{ color: S.muted }} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-5">
          {result ? (
            <div className="py-6 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: S.green }} />
              <p className="font-semibold text-sm" style={{ color: S.text }}>Price list imported</p>
              <p className="text-sm mt-1" style={{ color: S.muted }}>
                {result.added} added · {result.updated} updated{result.skipped > 0 ? ` · ${result.skipped} skipped (no description or price)` : ''}
              </p>
              <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: S.accent }}>Done</button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="price-list-file" className={labelCls} style={{ color: S.muted }}>Price list file</label>
                <label htmlFor="price-list-file"
                  className="flex items-center gap-3 px-4 py-4 rounded-xl cursor-pointer"
                  style={{ border: `1.5px dashed ${S.border}`, background: S.bg }}>
                  {parsing ? <Loader2 size={18} className="animate-spin" style={{ color: S.accent }} /> : <FileSpreadsheet size={18} style={{ color: S.accent }} />}
                  <span className="text-sm" style={{ color: fileName ? S.text : S.muted }}>
                    {parsing ? 'Reading…' : fileName || 'Choose a .csv, .xlsx or .xls file'}
                  </span>
                </label>
                <input id="price-list-file" type="file" accept=".csv,.xlsx,.xls" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }} />
              </div>

              {mapping && (
                <>
                  <div>
                    <p className={labelCls} style={{ color: S.muted }}>Match your columns</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {FIELDS.map(f => (
                        <div key={f.key}>
                          <label htmlFor={`map-${f.key}`} className="block text-xs mb-1" style={{ color: S.text }}>
                            {f.label}{f.required && <span style={{ color: S.danger }}> *</span>}
                          </label>
                          <select id={`map-${f.key}`} value={mapping[f.key]}
                            onChange={e => setMapping(m => m && { ...m, [f.key]: parseInt(e.target.value) })}
                            className="w-full px-2.5 py-2 text-sm rounded-lg outline-none" style={inputStyle}>
                            <option value={-1}>{f.required ? 'Choose a column' : 'Not in this file'}</option>
                            {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="import-supplier" className={labelCls} style={{ color: S.muted }}>Supplier</label>
                      <input id="import-supplier" value={supplierName} onChange={e => setSupplierName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label htmlFor="import-markup" className={labelCls} style={{ color: S.muted }}>Markup on cost (%)</label>
                      <input id="import-markup" type="number" min={0} step="0.5" value={markup} onChange={e => setMarkup(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
                      <p className="text-[10px] mt-1" style={{ color: S.muted }}>Applies to new items. Items you already set a markup on keep theirs.</p>
                    </div>
                  </div>

                  <div>
                    <p className={labelCls} style={{ color: S.muted }}>
                      Preview — {valid.length} of {mapped.length} row{mapped.length !== 1 ? 's' : ''} ready
                    </p>
                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                      <div className="grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ gridTemplateColumns: '90px 1fr 90px 90px', color: S.muted, background: S.bg }}>
                        <span>SKU</span><span>Description</span><span className="text-right">Cost</span><span className="text-right">Sell</span>
                      </div>
                      {valid.slice(0, 6).map((r, i) => (
                        <div key={i} className="grid px-3 py-2 text-xs" style={{ gridTemplateColumns: '90px 1fr 90px 90px', borderTop: `1px solid ${S.border}` }}>
                          <span className="truncate pr-2" style={{ color: S.muted }}>{r.sku ?? '—'}</span>
                          <span className="truncate pr-2" style={{ color: S.text }}>{r.brand ? `${r.brand} · ` : ''}{r.description}</span>
                          <span className="text-right" style={{ color: S.muted }}>{fmtR(r.cost)}</span>
                          <span className="text-right font-medium" style={{ color: S.text }}>
                            {Number.isFinite(markupNum) ? fmtR(r.cost * (1 + markupNum / 100)) : '—'}
                          </span>
                        </div>
                      ))}
                      {valid.length === 0 && (
                        <p className="px-3 py-4 text-xs text-center" style={{ color: S.muted, borderTop: `1px solid ${S.border}` }}>
                          No rows have both a description and a price — check the column matches above.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: '#FEF2F2', color: S.danger }}>
                  <AlertCircle size={13} />{error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={onClose} disabled={importing} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: S.muted, background: S.input }}>
                  Cancel
                </button>
                <button onClick={() => void handleImport()} disabled={!canImport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: S.accent }}>
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {importing ? 'Importing…' : `Import ${valid.length || ''} item${valid.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
