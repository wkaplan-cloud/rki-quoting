'use client'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface SyncLog {
  id: string
  sync_type: string
  started_at: string
  completed_at: string | null
  status: string
  items_checked: number | null
  items_changed: number | null
  items_added: number | null
  error_message: string | null
  triggered_by: string
}

interface Props {
  lastPriceSync: SyncLog | null
  lastCatalogueSync: SyncLog | null
  catalogueCount: number
  cronSecret: string
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

function ElapsedTimer({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      setElapsed(0)
      intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  if (!running) return null
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return (
    <span className="text-white/40 tabular-nums">
      {m > 0 ? `${m}m ` : ''}{s}s
    </span>
  )
}

function ProgressBar({ running }: { running: boolean }) {
  if (!running) return null
  return (
    <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-[#9A7B4F] to-transparent animate-pulse" />
    </div>
  )
}

function SyncRow({ label, log, onTrigger, triggering, syncType }: {
  label: string
  log: SyncLog | null
  onTrigger: () => void
  triggering: boolean
  syncType: 'prices' | 'catalogue'
}) {
  const age = daysSince(log?.completed_at ?? null)
  const stale = syncType === 'catalogue' ? (age == null || age > 30) : false
  const statusOk = log?.status === 'ok'

  return (
    <div className="py-4 border-b border-white/10 last:border-0">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{label}</p>
            {triggering && <ElapsedTimer running={triggering} />}
          </div>

          {log ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-white/50">
                Last run: <span className="text-white/70">{fmt(log.completed_at ?? log.started_at)}</span>
                {log.triggered_by === 'manual' && (
                  <span className="ml-2 text-[10px] bg-white/10 rounded px-1.5 py-0.5 text-white/40">manual</span>
                )}
              </p>
              {statusOk ? (
                <p className="text-xs text-white/50">
                  {syncType === 'prices'
                    ? <>{log.items_checked?.toLocaleString()} checked &middot; <span className={log.items_changed ? 'text-amber-400' : 'text-emerald-400'}>{log.items_changed ?? 0} changed</span></>
                    : <>{log.items_checked?.toLocaleString()} fetched &middot; <span className="text-emerald-400">{log.items_added ?? 0} new fabrics added</span></>
                  }
                </p>
              ) : !log.completed_at ? (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertCircle size={11} /> Sync did not complete — likely timed out. Try re-running.
                </p>
              ) : (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {log.error_message?.slice(0, 160) ?? 'Sync failed — try re-running or check logs.'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/40 mt-1">{triggering ? 'Running…' : 'Never run'}</p>
          )}

          {stale && !triggering && (
            <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
              <Clock size={11} />
              {age == null ? 'Catalogue has never been synced' : `${age} days since last catalogue sync — consider refreshing`}
            </p>
          )}
        </div>

        <button
          onClick={onTrigger}
          disabled={triggering}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={triggering ? 'animate-spin' : ''} />
          {triggering ? 'Syncing…' : syncType === 'prices' ? 'Sync Prices Now' : 'Sync Catalogue Now'}
        </button>
      </div>

      <ProgressBar running={triggering} />
    </div>
  )
}

function makeLog(partial: Partial<SyncLog> & { sync_type: string }): SyncLog {
  return {
    id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: 'ok',
    items_checked: null,
    items_changed: null,
    items_added: null,
    error_message: null,
    triggered_by: 'manual',
    ...partial,
  }
}

export function TwinbruSyncPanel({ lastPriceSync, lastCatalogueSync, catalogueCount, cronSecret }: Props) {
  const [priceSyncLog, setPriceSyncLog] = useState<SyncLog | null>(lastPriceSync)
  const [catalogueSyncLog, setCatalogueSyncLog] = useState<SyncLog | null>(lastCatalogueSync)
  const [triggeringPrices, setTriggeringPrices] = useState(false)
  const [triggeringCatalogue, setTriggeringCatalogue] = useState(false)
const [result, setResult] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  async function triggerSync(type: 'prices' | 'catalogue') {
    const setTriggering = type === 'prices' ? setTriggeringPrices : setTriggeringCatalogue
    setTriggering(true)
    setResult(null)
    try {
      const url = type === 'prices'
        ? '/api/cron/sync-prices'
        : '/api/cron/sync-catalogue?trigger=manual'

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const data = await res.json()

      if (!res.ok) {
        setResult({ type: 'err', msg: data.error ?? 'Sync failed' })
        return
      }

      if (type === 'prices') {
        setResult({ type: 'ok', msg: `Done — ${data.checked?.toLocaleString()} prices checked, ${data.changed ?? 0} updated` })
        setPriceSyncLog(prev => makeLog({
          ...(prev ?? {}),
          sync_type: 'prices',
          items_checked: data.checked,
          items_changed: data.changed,
        }))
      } else {
        const debugSuffix = data.debug ? ` | API response keys: [${data.debug.responseKeys?.join(', ')}] continuation: ${data.debug.continuation ?? 'none'}` : ''
        setResult({ type: data.checked === 0 ? 'err' : 'ok', msg: `Done — ${data.checked?.toLocaleString()} fetched, ${data.added ?? 0} new fabrics added${debugSuffix}` })
        setCatalogueSyncLog(prev => makeLog({
          ...(prev ?? {}),
          sync_type: 'catalogue',
          items_checked: data.checked,
          items_added: data.added,
        }))
      }
    } catch (e) {
      setResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setTriggering(false)
    }
  }

return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Twinbru Sync</h2>
        <span className="text-xs text-white/30">{catalogueCount.toLocaleString()} fabrics in catalogue</span>
      </div>
      <p className="text-xs text-white/30 mb-5">Prices sync automatically every night at 2am. Catalogue sync is manual — run it when new fabrics are added.</p>

      <SyncRow
        label="Price Sync"
        syncType="prices"
        log={priceSyncLog}
        onTrigger={() => triggerSync('prices')}
        triggering={triggeringPrices}
      />
      <SyncRow
        label="Catalogue Sync"
        syncType="catalogue"
        log={catalogueSyncLog}
        onTrigger={() => triggerSync('catalogue')}
        triggering={triggeringCatalogue}
      />

{result && (
        <div className={`mt-4 flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 ${
          result.type === 'ok' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
        }`}>
          {result.type === 'ok'
            ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
            : <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          }
          {result.msg}
        </div>
      )}
    </div>
  )
}
