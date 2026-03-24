'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Client } from '@/lib/types'
import { Users } from 'lucide-react'

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState('')
  const filtered = clients.filter(c =>
    !search || c.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <input
        type="text" placeholder="Search clients…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F] w-64"
      />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Users size={40} className="text-[#D8D3C8] mb-3" />
          <p className="text-[#8A877F] text-sm">No clients yet</p>
          <Link href="/clients/new" className="mt-2 text-sm text-[#9A7B4F] hover:underline">Add your first client →</Link>
        </div>
      ) : (
        <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-44" />
              <col className="w-36" />
              <col className="w-52" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC]">
                {['Name', 'Company', 'Email', 'Contact'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-[#EDE9E1] hover:bg-[#F5F2EC] cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-4 py-3 truncate"><Link href={`/clients/${c.id}`} className="block font-medium text-[#2C2C2A] hover:text-[#9A7B4F] truncate">{c.client_name}</Link></td>
                  <td className="px-4 py-3 truncate text-[#8A877F]"><Link href={`/clients/${c.id}`} className="block truncate">{c.company ?? '—'}</Link></td>
                  <td className="px-4 py-3 truncate text-[#8A877F]"><Link href={`/clients/${c.id}`} className="block truncate">{c.email ?? '—'}</Link></td>
                  <td className="px-4 py-3 truncate text-[#8A877F]"><Link href={`/clients/${c.id}`} className="block truncate">{c.contact_number ?? '—'}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
