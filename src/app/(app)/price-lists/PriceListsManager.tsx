'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Trash2, Upload, X, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface PriceList {
  id: string
  name: string
  supplier_name: string
  item_count: number
  created_at: string
}

interface ParsedItem {
  brand: string
  collection: string
  design: string
  colour: string
  sku: string
  product_id: string
  price_zar: string
  image_url: string
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const result: string[][] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const row: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    row.push(current.trim())
    result.push(row)
  }

  const headers = result[0] ?? []
  const rows = result.slice(1)
  return { headers, rows }
}

const COLUMN_MAP: Record<string, keyof ParsedItem> = {
  'brand': 'brand',
  'collection': 'collection',
  'design': 'design',
  'colour': 'colour',
  'color': 'colour',
  'sku': 'sku',
  'product id': 'product_id',
  'productid': 'product_id',
  'price (zar)': 'price_zar',
  'price(zar)': 'price_zar',
  'price': 'price_zar',
  'image url': 'image_url',
  'imageurl': 'image_url',
  'image': 'image_url',
}

function mapHeaders(headers: string[]): (keyof ParsedItem | null)[] {
  return headers.map(h => COLUMN_MAP[h.toLowerCase().trim()] ?? null)
}

export function PriceListsManager({ priceLists }: { priceLists: PriceList[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showImport, setShowImport] = useState(false)
  const [name, setName] = useState('')
  const [supplierName, setSupplierName] = useState('Home Fabrics')
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setParsedItems(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)
      const colMap = mapHeaders(headers)

      const mapped = colMap.filter(Boolean)
      if (mapped.length < 3) {
        setParseError('Could not detect expected columns. Make sure the CSV has the Home Fabrics format.')
        return
      }

      const items: ParsedItem[] = rows
        .filter(row => row.some(cell => cell.trim()))
        .map(row => {
          const item: Partial<ParsedItem> = {}
          colMap.forEach((key, i) => {
            if (key) item[key] = row[i] ?? ''
          })
          return item as ParsedItem
        })

      if (items.length === 0) {
        setParseError('No data rows found in CSV.')
        return
      }

      setParsedItems(items)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!name.trim() || !parsedItems?.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/price-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), supplier_name: supplierName, items: parsedItems }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowImport(false)
      resetForm()
      router.push(`/price-lists/${data.id}`)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch('/api/price-lists', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { setDeleteId(null); router.refresh() }
  }

  function resetForm() {
    setName('')
    setSupplierName('Home Fabrics')
    setParsedItems(null)
    setParseError('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      {/* List */}
      <div className="max-w-3xl space-y-4">
        <div className="flex justify-end mb-2">
          <Button onClick={() => setShowImport(true)}>
            <Plus size={14} /> Import Price List
          </Button>
        </div>

        {priceLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#D8D3C8] rounded-lg bg-white/50">
            <BookOpen size={32} className="text-[#C4A46B] mb-3 opacity-60" />
            <p className="text-sm font-medium text-[#2C2C2A]">No price lists yet</p>
            <p className="text-xs text-[#8A877F] mt-1">Import a CSV from your supplier to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {priceLists.map(pl => (
              <div
                key={pl.id}
                className="flex items-center justify-between bg-white border border-[#D8D3C8] rounded-lg px-5 py-4 group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#EDE9E1] flex items-center justify-center flex-shrink-0">
                    <BookOpen size={16} className="text-[#C4A46B]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#2C2C2A] truncate">{pl.name}</p>
                    <p className="text-xs text-[#8A877F] mt-0.5">
                      {pl.supplier_name} · {pl.item_count.toLocaleString()} items · {new Date(pl.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deleteId === pl.id ? (
                    <>
                      <span className="text-xs text-[#8A877F]">Delete?</span>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(pl.id)}>Yes</Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeleteId(null)}>No</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(pl.id)} className="opacity-0 group-hover:opacity-100">
                        <Trash2 size={13} />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/price-lists/${pl.id}`)}>
                        View <ChevronRight size={13} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8D3C8]">
              <h2 className="font-serif text-lg font-medium text-[#1A1A18]">Import Price List</h2>
              <button onClick={() => { setShowImport(false); resetForm() }} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <Input
                label="Price List Name"
                placeholder="e.g. Home Fabrics – March 2025"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <Input
                label="Supplier"
                placeholder="Home Fabrics"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
              />

              {/* File upload */}
              <div>
                <label className="text-xs font-medium text-[#8A877F] uppercase tracking-wider block mb-1">CSV File</label>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#D8D3C8] rounded-lg p-6 cursor-pointer hover:border-[#9A7B4F] hover:bg-[#F5F2EC] transition-colors">
                  <Upload size={20} className="text-[#C4A46B]" />
                  <span className="text-sm text-[#8A877F]">
                    {fileName ? fileName : 'Click to select CSV file'}
                  </span>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                </label>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              {parsedItems && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Preview</p>
                    <span className="text-xs text-[#8A877F] bg-[#EDE9E1] px-2 py-0.5 rounded-full">{parsedItems.length.toLocaleString()} rows</span>
                  </div>
                  <div className="border border-[#D8D3C8] rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[#F5F2EC]">
                          <tr>
                            {(['Brand', 'Collection', 'Design', 'Colour', 'SKU', 'Price (ZAR)'] as const).map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-[#8A877F] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EDE9E1]">
                          {parsedItems.slice(0, 5).map((item, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-2 text-[#2C2C2A] whitespace-nowrap">{item.brand || '–'}</td>
                              <td className="px-3 py-2 text-[#2C2C2A] whitespace-nowrap">{item.collection || '–'}</td>
                              <td className="px-3 py-2 text-[#2C2C2A] whitespace-nowrap">{item.design || '–'}</td>
                              <td className="px-3 py-2 text-[#2C2C2A] whitespace-nowrap">{item.colour || '–'}</td>
                              <td className="px-3 py-2 text-[#8A877F] whitespace-nowrap">{item.sku || '–'}</td>
                              <td className="px-3 py-2 text-[#2C2C2A] whitespace-nowrap">
                                {item.price_zar ? `R ${parseFloat(item.price_zar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '–'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedItems.length > 5 && (
                      <p className="text-xs text-[#8A877F] px-3 py-2 bg-[#F5F2EC] border-t border-[#D8D3C8]">
                        + {(parsedItems.length - 5).toLocaleString()} more rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#D8D3C8] flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowImport(false); resetForm() }}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!name.trim() || !parsedItems?.length || loading}
              >
                {loading ? 'Importing…' : `Import ${parsedItems ? parsedItems.length.toLocaleString() + ' items' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
