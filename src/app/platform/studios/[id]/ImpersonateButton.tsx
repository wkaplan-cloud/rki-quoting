'use client'
import { useState } from 'react'
import { UserCog, X, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export function ImpersonateButton({ orgId, studioName, adminEmail }: { orgId: string; studioName: string; adminEmail: string | null }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function impersonate() {
    setLoading(true)
    const res = await fetch(`/api/platform/studios/${orgId}/impersonate`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok || !data.signInUrl) {
      toast.error(data.error ?? 'Failed to start impersonation')
      setLoading(false)
      return
    }

    window.location.href = data.signInUrl
  }

  if (!adminEmail) return null

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#0F766E]/35 text-[#0F766E] text-xs font-medium hover:bg-teal-50 transition-colors flex-shrink-0 cursor-pointer"
      >
        <Eye size={13} />
        Impersonate
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !loading) setConfirming(false) }}
        >
          <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#DED8CC]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50">
                  <UserCog size={17} className="text-[#0F766E]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A18]">Impersonate studio admin</p>
                  <p className="text-xs text-[#6E6B63] mt-0.5">Logs you in as their account</p>
                </div>
              </div>
              {!loading && (
                <button onClick={() => setConfirming(false)} className="text-[#6E6B63] hover:text-[#1A1A18] transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#3F3D38] leading-relaxed">
                You are about to view the app as{' '}
                <span className="text-[#1A1A18] font-semibold">{adminEmail}</span>, admin of{' '}
                <span className="text-[#1A1A18] font-semibold">&ldquo;{studioName}&rdquo;</span>.
              </p>
              <div className="bg-teal-50 border border-[#0F766E]/30 rounded-lg px-4 py-3">
                <p className="text-xs text-[#0F766E] leading-relaxed">
                  This replaces your session with theirs — any action you take will be as them. You&apos;ll see an &ldquo;Exit impersonation&rdquo; banner while active, and it&apos;s logged.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setConfirming(false)} disabled={loading} className="flex-1 py-2.5 rounded-lg border border-[#DED8CC] text-[#3F3D38] text-sm hover:bg-[#EFEBE3] transition-colors disabled:opacity-40 cursor-pointer">
                  Cancel
                </button>
                <button onClick={impersonate} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-medium transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                  {loading ? 'Starting…' : 'Impersonate →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
