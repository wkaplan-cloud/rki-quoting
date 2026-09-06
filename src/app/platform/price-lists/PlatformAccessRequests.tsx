'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Building2 } from 'lucide-react'

interface Request {
  id: string
  org_id: string
  price_list_id: string
  status: string
  requested_at: string
  orgName: string
}

interface PriceList {
  id: string
  name: string
  supplier_name: string
}

export function PlatformAccessRequests({ requests, priceLists }: { requests: Request[]; priceLists: PriceList[] }) {
  const router = useRouter()
  const [acting, setActing] = useState<string | null>(null)

  async function act(req: Request, action: 'active' | 'rejected') {
    setActing(req.id)
    await fetch(`/api/price-lists/${req.price_list_id}/approve-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: req.org_id, action }),
    })
    setActing(null)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {requests.map(req => {
        const pl = priceLists.find(p => p.id === req.price_list_id)
        return (
          <div key={req.id} className="flex items-center justify-between bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#EFEBE3] flex items-center justify-center flex-shrink-0">
                <Building2 size={14} className="text-[#6E6B63]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1A18] truncate">{req.orgName}</p>
                <p className="text-xs text-[#6E6B63] mt-0.5">
                  Requesting access to <span className="text-[#3F3D38]">{pl?.name ?? req.price_list_id}</span>
                  {' · '}
                  {new Date(req.requested_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => act(req, 'rejected')}
                disabled={acting === req.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#B91C1C] border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <XCircle size={13} /> Reject
              </button>
              <button
                onClick={() => act(req, 'active')}
                disabled={acting === req.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#047857] border border-emerald-300 rounded hover:bg-emerald-50 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle size={13} /> Approve
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
