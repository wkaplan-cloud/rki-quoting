'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Supplier } from '@/lib/types'
import { Truck, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export function SuppliersTable({ suppliers: initial }: { suppliers: Supplier[] }) {
  const [search, setSearch] = useState('')
  const [suppliers, setSuppliers] = useState(initial)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filtered = suppliers.filter(s =>
    !search ||
    s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const confirmSupplier = suppliers.find(s => s.id === confirmId)

  async function handleDelete() {
    if (!confirmId) return
    setDeleting(true)
    const { error } = await supabase.from('suppliers').delete().eq('id', confirmId)
    if (error) {
      toast.error('Failed to delete supplier')
    } else {
      setSuppliers(prev => prev.filter(s => s.id !== confirmId))
      toast.success('Supplier deleted')
      router.refresh()
    }
    setConfirmId(null)
    setDeleting(false)
  }

  return (
    <div className="space-y-4">
      <input type="text" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)}
        className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] w-64" />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Truck size={40} className="text-[#D8D3C8] mb-3" />
          <p className="text-[#8A877F] text-sm">No suppliers yet</p>
          <Link href="/suppliers/new" className="mt-2 text-sm text-[#9A7B4F] hover:underline">Add your first supplier →</Link>
        </div>
      ) : (
        <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC]">
                {['Supplier', 'Category', 'Contact Person', 'Email', 'Default Markup', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`group border-b border-[#EDE9E1] hover:bg-[#F5F2EC] cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-4 py-3"><Link href={`/suppliers/${s.id}`} className="block font-medium text-[#2C2C2A] hover:text-[#9A7B4F]">{s.supplier_name}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.category ?? '—'}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.contact_person ?? '—'}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.email ?? '—'}</Link></td>
                  <td className="px-4 py-3"><Link href={`/suppliers/${s.id}`} className="block">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#9A7B4F]/10 text-[#9A7B4F] text-xs font-medium">{s.markup_percentage}%</span>
                  </Link></td>
                  <td className="px-4 py-3 w-10 text-right">
                    <button
                      onClick={e => { e.preventDefault(); setConfirmId(s.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#D8D3C8] hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmId(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[360px] p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-[#1A1A18] mb-1">Delete supplier?</h2>
            <p className="text-sm text-[#8A877F]">
              Are you sure you want to delete <span className="font-medium text-[#2C2C2A]">{confirmSupplier?.supplier_name}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmId(null)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
