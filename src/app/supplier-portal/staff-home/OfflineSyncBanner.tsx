'use client'
import { useState, useEffect, useCallback } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { pendingCount, flushQueue } from '@/lib/offline-punch-queue'

const S = {
  accent: '#3A7CA5',
  gold: '#D9A441',
  green: '#16A34A',
  border: '#E4E4E7',
}

interface Props {
  onSynced?: () => void
}

export function OfflineSyncBanner({ onSynced }: Props) {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  // Read queue on mount and whenever the component re-renders
  useEffect(() => {
    setPending(pendingCount())
  }, [])

  const sync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    await flushQueue(remaining => setPending(remaining))
    const remaining = pendingCount()
    setPending(remaining)
    setSyncing(false)
    if (remaining === 0) {
      setJustSynced(true)
      onSynced?.()
      setTimeout(() => setJustSynced(false), 3000)
    }
  }, [syncing, onSynced])

  // Auto-sync whenever network comes back online
  useEffect(() => {
    const handler = () => { if (pendingCount() > 0) void sync() }
    window.addEventListener('online', handler)
    // Also try immediately in case we're already online with a backlog
    if (navigator.onLine && pendingCount() > 0) void sync()
    return () => window.removeEventListener('online', handler)
  }, [sync])

  if (pending === 0 && !justSynced) return null

  if (justSynced) return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 mx-4 mt-3 rounded-2xl"
      style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
      <CheckCircle2 size={14} style={{ color: S.green }} />
      <p className="text-xs font-semibold flex-1" style={{ color: S.green }}>Punches synced ✓</p>
    </div>
  )

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 mx-4 mt-3 rounded-2xl"
      style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.3)' }}>
      <WifiOff size={14} style={{ color: S.gold }} />
      <p className="text-xs font-semibold flex-1" style={{ color: S.gold }}>
        {pending} punch{pending !== 1 ? 'es' : ''} saved offline
      </p>
      <button
        onClick={() => void sync()}
        disabled={syncing || !navigator.onLine}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
        style={{ background: S.accent, color: '#fff' }}>
        <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}
