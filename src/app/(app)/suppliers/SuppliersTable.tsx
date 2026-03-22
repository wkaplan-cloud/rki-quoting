'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Supplier } from '@/lib/types'
import { Truck } from 'lucide-react'

export function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const [search, setSearch] = useState('')
  const filtered = suppliers.filter(s =>
    !search ||
    s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

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
                {['Supplier', 'Category', 'Contact Person', 'Email', 'Default Markup'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-[#EDE9E1] hover:bg-[#F5F2EC] cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-4 py-3"><Link href={`/suppliers/${s.id}`} className="block font-medium text-[#2C2C2A] hover:text-[#9A7B4F]">{s.supplier_name}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.category ?? '—'}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.contact_person ?? '—'}</Link></td>
                  <td className="px-4 py-3 text-[#8A877F]"><Link href={`/suppliers/${s.id}`} className="block">{s.email ?? '—'}</Link></td>
                  <td className="px-4 py-3"><Link href={`/suppliers/${s.id}`} className="block">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#9A7B4F]/10 text-[#9A7B4F] text-xs font-medium">{s.markup_percentage}%</span>
                  </Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
