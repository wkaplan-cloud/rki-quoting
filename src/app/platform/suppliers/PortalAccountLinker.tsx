'use client'
import { useState } from 'react'
import { Link2, Link2Off } from 'lucide-react'
import toast from 'react-hot-toast'

interface PortalAccount {
  id: string
  email: string
  company_name: string | null
  contact_name: string | null
  linked_portal_account_id: string | null
}

export function PortalAccountLinker({ accounts }: { accounts: PortalAccount[] }) {
  const [rows, setRows] = useState(accounts)
  const [saving, setSaving] = useState<string | null>(null)

  async function handleLink(accountId: string, linkedAccountId: string | null) {
    setSaving(accountId)
    const res = await fetch('/api/platform/supplier-portal-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, linkedAccountId }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === accountId ? { ...r, linked_portal_account_id: linkedAccountId } : r))
      toast.success(linkedAccountId ? 'Accounts linked' : 'Link removed')
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to update')
    }
    setSaving(null)
  }

  if (accounts.length === 0) return null

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-[#C4A46B]" />
          <h2 className="text-sm font-medium text-white">Portal Account Linking</h2>
        </div>
        <p className="text-xs text-white/30 mt-0.5">
          Link a second contact from the same company so they see the same requests when they log in.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Account', 'Email', 'Sees same requests as'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(row => {
              const isSaving = saving === row.id
              return (
                <tr key={row.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-white font-medium">{row.company_name ?? '—'}</p>
                    {row.contact_name && <p className="text-white/30 text-xs mt-0.5">{row.contact_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{row.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        disabled={isSaving}
                        value={row.linked_portal_account_id ?? ''}
                        onChange={e => handleLink(row.id, e.target.value || null)}
                        className="bg-[#0F0F0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[#C4A46B] disabled:opacity-50 min-w-[240px] cursor-pointer"
                      >
                        <option value="">— Not linked —</option>
                        {rows.filter(r => r.id !== row.id).map(r => (
                          <option key={r.id} value={r.id}>
                            {r.company_name ?? r.email}{r.contact_name ? ` · ${r.contact_name}` : ''} ({r.email})
                          </option>
                        ))}
                      </select>
                      {row.linked_portal_account_id && (
                        <button
                          onClick={() => handleLink(row.id, null)}
                          disabled={isSaving}
                          title="Remove link"
                          className="text-white/30 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Link2Off size={13} />
                        </button>
                      )}
                      {isSaving && <span className="text-white/30 text-xs">Saving…</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
