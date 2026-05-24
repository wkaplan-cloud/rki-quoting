'use client'
import { useState } from 'react'
import { StickyNote } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export function StudioNotes({ orgId, initial }: { orgId: string; initial: string | null }) {
  const router = useRouter()
  const [notes, setNotes] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/platform/studios/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform_notes: notes }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Notes saved')
      setDirty(false)
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to save')
    }
  }

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white flex items-center gap-2">
          <StickyNote size={14} className="text-[#C4A46B]" /> Internal Notes
        </h2>
        <span className="text-xs text-white/20">Only visible to platform admins</span>
      </div>
      <div className="p-5 space-y-3">
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setDirty(true) }}
          placeholder="Add notes about this studio — calls, upgrade interest, support history, anything relevant…"
          rows={4}
          className="w-full bg-[#0F0F0D] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#9A7B4F] resize-none"
        />
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-[#9A7B4F] text-white text-xs font-medium rounded-lg hover:bg-[#B8956A] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        )}
      </div>
    </div>
  )
}
