'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function DeleteStudioButton({ orgId, studioName }: { orgId: string; studioName: string }) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Permanently delete "${studioName}"?\n\nThis will remove the organisation, all its members, projects, clients, suppliers, and settings. This cannot be undone.`)) return

    setDeleting(true)
    const res = await fetch(`/api/platform/studios/${orgId}`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? 'Failed to delete studio')
      setDeleting(false)
      return
    }

    toast.success(`"${studioName}" has been deleted`)
    router.push('/platform/studios')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
    >
      <Trash2 size={13} />
      {deleting ? 'Deleting…' : 'Delete studio'}
    </button>
  )
}
