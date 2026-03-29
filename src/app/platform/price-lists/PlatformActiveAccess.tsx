'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ShieldOff } from 'lucide-react'

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

export function PlatformActiveAccess({ access, priceLists }: { access: AccessRow[]; priceLists: PriceList[] }) {
  const router = useRouter()
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function revoke(row: AccessRow) {
    setRevoking(row.id)
    await fetch(`/api/price-lists/${row.price_list_id}/approve-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: row.org_id, action: 'rejected' }),
    })
    setRevoking(null)
    setConfirmId(null)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {access.map(row => {
        const pl = priceLists.find(p => p.id === row.price_list_id)
        return (
          <div key={row.id} className="flex items-center justify-between bg-[#1A1A18] border border-white/10 rounded-lg px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <Building2 size={14} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{row.orgName}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Access to <span className="text-white/60">{pl?.name ?? row.price_list_id}</span>
                  {row.approved_at && (
                    <> · Approved {new Date(row.approved_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {confirmId === row.id ? (
                <>
                  <span className="text-xs text-white/40">Revoke access?</span>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => revoke(row)}
                    disabled={revoking === row.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 border border-red-900/50 rounded hover:bg-red-950/40 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ShieldOff size={12} /> {revoking === row.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmId(row.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/30 border border-white/10 rounded hover:text-red-400 hover:border-red-900/50 transition-colors cursor-pointer"
                >
                  <ShieldOff size={12} /> Revoke
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
