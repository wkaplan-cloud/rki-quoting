'use client'
import { useRef, useState } from 'react'
import { Plus, Trash2, Pencil, Upload, X, Download } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'
import type { SupplierPriceListItem } from '@/lib/types'

interface Props {
  initialItems: SupplierPriceListItem[]
}

type ItemForm = {
  item_name: string
  description: string
  sku: string
  unit: string
  price: string
  lead_time_weeks: string
  image_url: string | null
}

const EMPTY_FORM: ItemForm = {
  item_name: '',
  description: '',
  sku: '',
  unit: '',
  price: '',
  lead_time_weeks: '',
  image_url: null,
}

function itemToForm(item: SupplierPriceListItem): ItemForm {
  return {
    item_name: item.item_name,
    description: item.description ?? '',
    sku: item.sku ?? '',
    unit: item.unit ?? '',
    price: item.price?.toString() ?? '',
    lead_time_weeks: item.lead_time_weeks?.toString() ?? '',
    image_url: item.image_url,
  }
}

const INPUT_STYLE = {
  background: '#1C2B3A',
  border: '1px solid #2D4159',
  color: '#E8F0F8',
}

export function PriceListManager({ initialItems }: Props) {
  const [items, setItems] = useState<SupplierPriceListItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  function startNew() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    setError(null)
  }

  function startEdit(item: SupplierPriceListItem) {
    setEditingId(item.id)
    setForm(itemToForm(item))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function setField<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    let compressed: File
    try { compressed = await compressImage(file) } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); setUploadingImage(false); return }
    const formData = new FormData()
    formData.append('file', compressed)
    const res = await fetch('/api/supplier-portal/price-list/upload-image', { method: 'POST', body: formData })
    const data = await res.json() as { url?: string; error?: string }
    setUploadingImage(false)
    if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
    setField('image_url', data.url ?? null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function handleSave() {
    if (!form.item_name.trim()) { setError('Item name is required'); return }
    setSaving(true)
    setError(null)
    const payload = {
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      unit: form.unit.trim() || null,
      price: form.price ? parseFloat(form.price) : null,
      lead_time_weeks: form.lead_time_weeks ? parseInt(form.lead_time_weeks) : null,
      image_url: form.image_url,
    }

    if (editingId === 'new') {
      const res = await fetch('/api/supplier-portal/price-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { item?: SupplierPriceListItem; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
      if (data.item) setItems(prev => [...prev, data.item!])
    } else if (editingId) {
      const res = await fetch(`/api/supplier-portal/price-list?item_id=${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { item?: SupplierPriceListItem; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to save'); setSaving(false); return }
      if (data.item) setItems(prev => prev.map(i => i.id === editingId ? data.item! : i))
    }

    setSaving(false)
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    setDeletingId(id)
    await fetch(`/api/supplier-portal/price-list?item_id=${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setDeletingId(null)
    if (editingId === id) cancelEdit()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/supplier-portal/price-list/import', { method: 'POST', body: formData })
    const data = await res.json() as { count?: number; error?: string }
    setImporting(false)
    if (importInputRef.current) importInputRef.current.value = ''
    if (!res.ok) { setImportMsg(`Error: ${data.error ?? 'Import failed'}`); return }
    setImportMsg(`Imported ${data.count} item${data.count !== 1 ? 's' : ''} successfully.`)
    const listRes = await fetch('/api/supplier-portal/price-list')
    const listData = await listRes.json() as { items?: SupplierPriceListItem[] }
    if (listData.items) setItems(listData.items)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1C2B3A' }}>My Price List</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5A7A95' }}>Add your products and services with pricing.</p>
        </div>
        <div className="flex items-center gap-2">
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ background: '#EBF0F5', border: '1px solid #C5D5E5', color: '#4A7FA5' }}
          >
            <Upload size={13} />
            {importing ? 'Importing…' : 'Import CSV / Excel'}
            <input ref={importInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
            style={{ background: '#3B82F6', color: '#FFFFFF' }}
          >
            <Plus size={13} />
            Add Item
          </button>
        </div>
      </div>

      {importMsg && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={importMsg.startsWith('Error')
            ? { background: '#1A1020', color: '#F87171', border: '1px solid #3B1F1F' }
            : { background: '#0D2218', color: '#34D399', border: '1px solid #164430' }
          }
        >
          {importMsg}
          <button onClick={() => setImportMsg(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Items table */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#D8E4EF' }}>
          {items.length === 0 && editingId !== 'new' ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: '#1C2B3A' }}>No items yet</p>
              <p className="text-sm mb-4" style={{ color: '#5A7A95' }}>Add items manually or import a CSV/Excel file.</p>
              <button onClick={startNew} className="text-sm font-medium hover:opacity-80 transition-opacity" style={{ color: '#3B82F6' }}>
                Add your first item →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #E8F0F8', background: '#F7FAFC' }}>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#7A9AB8' }}>Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest hidden sm:table-cell" style={{ color: '#7A9AB8' }}>Price</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest hidden md:table-cell" style={{ color: '#7A9AB8' }}>Lead Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-[#F7FAFC]"
                    style={{ borderBottom: '1px solid #F0F4F8' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.item_name} className="w-9 h-9 rounded object-cover flex-shrink-0" style={{ border: '1px solid #D8E4EF' }} />
                        ) : (
                          <div className="w-9 h-9 rounded flex-shrink-0" style={{ background: '#EBF0F5', border: '1px solid #D8E4EF' }} />
                        )}
                        <div>
                          <p className="font-semibold" style={{ color: '#1C2B3A' }}>{item.item_name}</p>
                          {item.sku && <p className="text-xs" style={{ color: '#7A9AB8' }}>SKU: {item.sku}</p>}
                          {item.description && <p className="text-xs truncate max-w-[200px]" style={{ color: '#7A9AB8' }}>{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm hidden sm:table-cell" style={{ color: '#1C2B3A' }}>
                      {item.price != null ? `R ${item.price.toFixed(2)}${item.unit ? ` / ${item.unit}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs hidden md:table-cell" style={{ color: '#7A9AB8' }}>
                      {item.lead_time_weeks != null ? `${item.lead_time_weeks}w` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(item)} className="transition-opacity hover:opacity-60" style={{ color: '#7A9AB8' }}><Pencil size={13} /></button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="transition-opacity hover:opacity-60 disabled:opacity-30"
                          style={{ color: '#B0C4D8' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / Edit form */}
        {editingId !== null && (
          <div className="rounded-xl overflow-hidden sticky top-4" style={{ background: '#162231', border: '1px solid #1C2B3A' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1C2B3A' }}>
              <p className="text-sm font-semibold" style={{ color: '#E8F0F8' }}>{editingId === 'new' ? 'Add Item' : 'Edit Item'}</p>
              <button onClick={cancelEdit} className="transition-opacity hover:opacity-60" style={{ color: '#4A7FA5' }}><X size={14} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Image */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Image</label>
                {form.image_url ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden" style={{ border: '1px solid #2D4159' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setField('image_url', null)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex items-center justify-center gap-2 h-20 rounded-lg cursor-pointer transition-colors text-sm ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ border: '1px dashed #2D4159', color: '#4A7FA5' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#2D4159')}
                  >
                    <Upload size={13} />
                    {uploadingImage ? 'Uploading…' : 'Upload image'}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>
                  Item Name <span style={{ color: '#F87171' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.item_name}
                  onChange={e => setField('item_name', e.target.value)}
                  placeholder="e.g. Linen Fabric — Natural"
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                  style={INPUT_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="Material specs, colours, etc."
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
                  style={INPUT_STYLE}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>SKU / Code</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={e => setField('sku', e.target.value)}
                    placeholder="ABC-001"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setField('unit', e.target.value)}
                    placeholder="e.g. m, m², each"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Price (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setField('price', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#5A7A95' }}>Lead Time (wks)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.lead_time_weeks}
                    onChange={e => setField('lead_time_weeks', e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                    style={INPUT_STYLE}
                    onFocus={e => (e.currentTarget.style.borderColor = '#3B82F6')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#2D4159')}
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs px-2 py-1.5 rounded" style={{ background: '#1A1020', color: '#F87171' }}>{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: '#3B82F6', color: '#FFFFFF' }}
                >
                  {saving ? 'Saving…' : editingId === 'new' ? 'Add Item' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2.5 text-sm rounded-lg transition-colors"
                  style={{ color: '#7A9AB8', border: '1px solid #2D4159' }}
                >
                  Cancel
                </button>
              </div>

              {editingId === null && (
                <div className="pt-2" style={{ borderTop: '1px solid #1C2B3A' }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#4A7FA5' }}>
                    <Download size={11} />
                    <span>Columns: item_name, description, sku, unit, price, lead_time_weeks</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import hint when no form open */}
        {editingId === null && items.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: '#162231', border: '1px solid #1C2B3A' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4A7FA5' }}>CSV / Excel Import</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#5A7A95' }}>
              Import multiple items at once. Your file should have these columns:
            </p>
            <code className="block text-xs rounded px-3 py-2 leading-relaxed" style={{ background: '#1C2B3A', color: '#7A9AB8', border: '1px solid #2D4159' }}>
              item_name, description, sku,<br />
              unit, price, lead_time_weeks
            </code>
            <p className="text-xs mt-2" style={{ color: '#2D4159' }}>Supports .csv, .xlsx, .xls — max 500 rows</p>
          </div>
        )}
      </div>
    </div>
  )
}
