'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

interface AccessRow {
  id: string
  org_id: string
  price_list_id: string
  status: string
  approved_at: string | null
  orgName: string
}

interface PriceList {
  id: string
  name: string
}

function Toggle({ enabled, loading, onToggle }: { enabled: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      title={enabled ? 'Revoke access' : 'Restore access'}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 cursor-pointer ${
        enabled ? 'bg-emerald-600' : 'bg-[#DED8CC]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function PlatformActiveAccess({ access, priceLists }: { access: AccessRow[]; priceLists: PriceList[] }) {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(access.map(r => [r.id, r.status]))
  )
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(row: AccessRow) {
    const current = statuses[row.id] ?? row.status
    const next = current === 'active' ? 'rejected' : 'active'
    setLoading(row.id)
    setStatuses(prev => ({ ...prev, [row.id]: next }))
    await fetch(`/api/price-lists/${row.price_list_id}/approve-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: row.org_id, action: next }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {access.map(row => {
        const pl = priceLists.find(p => p.id === row.price_list_id)
        const isActive = (statuses[row.id] ?? row.status) === 'active'
        return (
          <div key={row.id} className="flex items-center justify-between bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-50' : 'bg-[#EFEBE3]'}`}>
                <Building2 size={14} className={isActive ? 'text-[#047857]' : 'text-[#6E6B63]'} />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isActive ? 'text-[#1A1A18]' : 'text-[#6E6B63]'}`}>{row.orgName}</p>
                <p className="text-xs text-[#6E6B63] mt-0.5">
                  {isActive ? 'Access to' : 'Revoked —'} <span className="text-[#3F3D38]">{pl?.name ?? row.price_list_id}</span>
                  {row.approved_at && isActive && (
                    <> · Approved {new Date(row.approved_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-[#6E6B63]">{isActive ? 'Allowed' : 'Revoked'}</span>
              <Toggle
                enabled={isActive}
                loading={loading === row.id}
                onToggle={() => toggle(row)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
