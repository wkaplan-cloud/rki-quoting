'use client'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Database, Trash2 } from 'lucide-react'

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
  lastLoadSync: SyncLog | null
  catalogueCount: number
  cronSecret: string
}

type SyncResult = { type: 'ok' | 'err'; msg: string } | null

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

function ResultBanner({ result }: { result: SyncResult }) {
  if (!result) return null
  return (
    <div className={`mt-2 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
      result.type === 'ok' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
    }`}>
      {result.type === 'ok'
        ? <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
        : <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
      }
      {result.msg}
    </div>
  )
}

function makeLog(partial: Partial<SyncLog> & { sync_type: string }): SyncLog {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    status: 'ok',
    items_checked: null,
    items_changed: null,
    items_added: null,
    error_message: null,
    triggered_by: 'manual',
    ...partial,
    // Must come after ...partial so the fresh timestamp always wins
    started_at: now,
    completed_at: now,
  }
}

async function safeFetch(url: string, cronSecret: string): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })
  const rawText = await res.text()
  let data: Record<string, unknown> = {}
  try { data = rawText ? JSON.parse(rawText) : {} } catch { /* non-JSON */ }
  if (!res.ok && !data.error) data.error = rawText.slice(0, 200)
  return { ok: res.ok, status: res.status, data }
}

export function TwinbruSyncPanel({ lastPriceSync, lastLoadSync, catalogueCount, cronSecret }: Props) {
  const [priceSyncLog, setPriceSyncLog] = useState<SyncLog | null>(lastPriceSync)
  const [loadSyncLog, setLoadSyncLog] = useState<SyncLog | null>(lastLoadSync)

  const [triggeringPrices, setTriggeringPrices] = useState(false)
  const [triggeringLoad, setTriggeringLoad] = useState(false)

  const [priceResult, setPriceResult] = useState<SyncResult>(null)
  const [loadResult, setLoadResult] = useState<SyncResult>(null)

  // Tracks total fabrics added across all auto-continue runs for the load
  const loadAddedRef = useRef(0)
  const loadCheckedRef = useRef(0)

  // Allows cancelling auto-continue if user navigates away
  const loadRunningRef = useRef(false)

  // Discontinued scan state
  type DiscontinuedState = 'idle' | 'scanning' | 'found' | 'deleting' | 'done'
  const [discontinuedState, setDiscontinuedState] = useState<DiscontinuedState>('idle')
  const [discontinuedResult, setDiscontinuedResult] = useState<SyncResult>(null)
  const [discontinuedCount, setDiscontinuedCount] = useState(0)
  const [discontinuedProductIds, setDiscontinuedProductIds] = useState<string[]>([])
  const [discontinuedTotalInDb, setDiscontinuedTotalInDb] = useState(0)
  const activeIdsRef = useRef<string[]>([])
  const discontinuedCurrentYearRef = useRef(0)

  async function triggerPriceSync() {
    setTriggeringPrices(true)
    setPriceResult(null)
    try {
      const { ok, data } = await safeFetch('/api/cron/sync-prices', cronSecret)
      if (!ok) {
        setPriceResult({ type: 'err', msg: String(data.error ?? 'Sync failed') })
        return
      }
      const checked = data.checked as number | null
      const changed = data.changed as number | null
      setPriceResult({ type: 'ok', msg: `Done — ${checked?.toLocaleString()} prices checked, ${changed ?? 0} updated` })
      setPriceSyncLog(prev => makeLog({ ...(prev ?? {}), sync_type: 'prices', items_checked: checked, items_changed: changed }))
    } catch (e) {
      setPriceResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setTriggeringPrices(false)
    }
  }

  // Full load via POST /products/search — auto-continues across years/pages
  async function triggerFullLoad() {
    loadRunningRef.current = true
    loadAddedRef.current = 0
    loadCheckedRef.current = 0
    loadInvocationRef.current = 0
    setTriggeringLoad(true)
    setLoadResult(null)
    await runLoadOnce()
  }

  const loadInvocationRef = useRef(0)

  async function runLoadOnce() {
    if (!loadRunningRef.current) return
    // First invocation = manual (fresh start), subsequent = continue (uses RESUME token)
    const trigger = loadInvocationRef.current === 0 ? 'manual' : 'continue'
    loadInvocationRef.current++
    try {
      const { ok, data } = await safeFetch(`/api/cron/load-catalogue?trigger=${trigger}`, cronSecret)
      if (!ok) {
        setLoadResult({ type: 'err', msg: String(data.error ?? 'Load failed') })
        loadRunningRef.current = false
        setTriggeringLoad(false)
        return
      }
      loadAddedRef.current += (data.added as number | null) ?? 0
      loadCheckedRef.current += (data.checked as number | null) ?? 0
      if (data.partial) {
        setLoadResult({ type: 'ok', msg: `Loading… ${loadCheckedRef.current.toLocaleString()} products scanned, ${loadAddedRef.current.toLocaleString()} new fabrics added so far. Continuing in 10s…` })
        setTimeout(() => runLoadOnce(), 10_000)
      } else {
        setLoadResult({ type: 'ok', msg: `Complete — ${loadCheckedRef.current.toLocaleString()} products scanned, ${loadAddedRef.current.toLocaleString()} new fabrics added` })
        setLoadSyncLog(prev => makeLog({ ...(prev ?? {}), sync_type: 'load', items_checked: loadCheckedRef.current, items_added: loadAddedRef.current }))
        loadRunningRef.current = false
        setTriggeringLoad(false)
      }
    } catch (e) {
      setLoadResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      loadRunningRef.current = false
      setTriggeringLoad(false)
    }
  }

  const START_YEAR = 2000
  const END_YEAR   = new Date().getFullYear()

  async function startDiscontinuedScan() {
    activeIdsRef.current = []
    discontinuedCurrentYearRef.current = START_YEAR
    setDiscontinuedState('scanning')
    setDiscontinuedResult(null)
    setDiscontinuedCount(0)
    setDiscontinuedProductIds([])
    await scanNextYear()
  }

  async function scanNextYear() {
    const year = discontinuedCurrentYearRef.current
    if (year > END_YEAR) {
      // All years scanned — compare against DB
      await compareWithDb()
      return
    }
    try {
      const res = await fetch(`/api/cron/find-discontinued?year=${year}`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setDiscontinuedResult({ type: 'err', msg: String(d.error ?? 'Scan failed') })
        setDiscontinuedState('idle')
        return
      }
      const { activeIds } = await res.json() as { activeIds: string[] }
      activeIdsRef.current.push(...activeIds)
      setDiscontinuedResult({ type: 'ok', msg: `Scanning… year ${year} (${activeIdsRef.current.length.toLocaleString()} active found so far)` })
      discontinuedCurrentYearRef.current = year + 1
      await scanNextYear()
    } catch (e) {
      setDiscontinuedResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      setDiscontinuedState('idle')
    }
  }

  async function compareWithDb() {
    try {
      const res = await fetch('/api/cron/find-discontinued', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeProductIds: activeIdsRef.current }),
      })
      const d = await res.json()
      if (!res.ok) {
        setDiscontinuedResult({ type: 'err', msg: String(d.error ?? 'Compare failed') })
        setDiscontinuedState('idle')
        return
      }
      setDiscontinuedCount(d.discontinuedCount)
      setDiscontinuedProductIds(d.discontinuedProductIds)
      setDiscontinuedTotalInDb(d.totalInDb)
      if (d.discontinuedCount === 0) {
        setDiscontinuedResult({ type: 'ok', msg: `All ${d.totalInDb.toLocaleString()} fabrics in your catalogue are active on Twinbru. Nothing to delete.` })
        setDiscontinuedState('done')
      } else {
        setDiscontinuedResult(null)
        setDiscontinuedState('found')
      }
    } catch (e) {
      setDiscontinuedResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      setDiscontinuedState('idle')
    }
  }

  async function deleteDiscontinued() {
    setDiscontinuedState('deleting')
    try {
      const res = await fetch('/api/cron/find-discontinued', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: discontinuedProductIds }),
      })
      const d = await res.json()
      if (!res.ok) {
        setDiscontinuedResult({ type: 'err', msg: String(d.error ?? 'Delete failed') })
        setDiscontinuedState('found')
        return
      }
      setDiscontinuedResult({ type: 'ok', msg: `Done — ${d.deleted.toLocaleString()} discontinued fabrics removed. ${(discontinuedTotalInDb - d.deleted).toLocaleString()} active fabrics remain.` })
      setDiscontinuedState('done')
    } catch (e) {
      setDiscontinuedResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      setDiscontinuedState('found')
    }
  }

  const priceSyncOk = priceSyncLog?.status === 'ok'

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Twinbru Sync</h2>
        <span className="text-xs text-white/30">{catalogueCount.toLocaleString()} fabrics in catalogue</span>
      </div>
      <p className="text-xs text-white/30 mb-5">Three separate syncs keep your catalogue current. Each runs automatically at 2am — use the buttons to trigger manually.</p>

      {/* Price Sync */}
      <div className="py-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Price Sync</p>
              {triggeringPrices && <ElapsedTimer running={triggeringPrices} />}
            </div>
            <p className="text-xs text-white/30 mb-1">Updates the ZAR price on every fabric already in the catalogue. Runs nightly at 2am. Does not add or remove fabrics.</p>
            {priceSyncLog ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-white/50">Last run: <span className="text-white/70">{fmt(priceSyncLog.completed_at ?? priceSyncLog.started_at)}</span></p>
                {priceSyncOk ? (
                  <p className="text-xs text-white/50">
                    {priceSyncLog.items_checked?.toLocaleString()} checked &middot;{' '}
                    <span className={priceSyncLog.items_changed ? 'text-amber-400' : 'text-emerald-400'}>
                      {priceSyncLog.items_changed ?? 0} changed
                    </span>
                  </p>
                ) : !priceSyncLog.completed_at ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={11} /> Did not complete — likely timed out.</p>
                ) : (
                  <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {priceSyncLog.error_message?.slice(0, 160) ?? 'Failed'}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-1">{triggeringPrices ? 'Running…' : 'Never run'}</p>
            )}
            <ResultBanner result={priceResult} />
          </div>
          <button onClick={triggerPriceSync} disabled={triggeringPrices}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed">
            <RefreshCw size={12} className={triggeringPrices ? 'animate-spin' : ''} />
            {triggeringPrices ? 'Syncing…' : 'Sync Prices Now'}
          </button>
        </div>
        <ProgressBar running={triggeringPrices} />
      </div>

      {/* Full Catalogue Load (POST /products/search by year) */}
      <div className="py-4">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Load Full Catalogue</p>
              {triggeringLoad && <ElapsedTimer running={triggeringLoad} />}
            </div>
            <p className="text-xs text-white/30 mb-1">Fetches every fabric from Twinbru and adds any that are not already in the catalogue. Safe to run at any time — existing fabrics and prices are never overwritten or deleted. Runs in 4-min chunks and auto-continues until complete.</p>
            {loadSyncLog ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-white/50">Last run: <span className="text-white/70">{fmt(loadSyncLog.completed_at ?? loadSyncLog.started_at)}</span></p>
                {loadSyncLog.status === 'ok' ? (
                  <p className="text-xs text-white/50">
                    {loadSyncLog.items_checked?.toLocaleString()} scanned &middot;{' '}
                    <span className="text-emerald-400">{loadSyncLog.items_added ?? 0} added</span>
                  </p>
                ) : (
                  <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {loadSyncLog.error_message?.slice(0, 160) ?? 'Failed'}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-1">{triggeringLoad ? 'Running…' : 'Never run'}</p>
            )}
            <ResultBanner result={loadResult} />
          </div>
          <button onClick={triggerFullLoad} disabled={triggeringLoad}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#9A7B4F]/20 hover:bg-[#9A7B4F]/30 text-[#C8A97A] transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed">
            <Database size={12} className={triggeringLoad ? 'animate-pulse' : ''} />
            {triggeringLoad ? 'Loading…' : 'Load All Fabrics'}
          </button>
        </div>
        <ProgressBar running={triggeringLoad} />
      </div>

      {/* Find Discontinued & Delete */}
      <div className="py-4 border-t border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Find Discontinued & Delete</p>
              {discontinuedState === 'scanning' && <ElapsedTimer running={true} />}
            </div>
            <p className="text-xs text-white/30 mb-2">Scans Twinbru for all currently active fabrics (year by year), then compares against your catalogue. Any fabric in your database that Twinbru no longer lists as active will be shown for deletion.</p>

            {discontinuedState === 'found' && (
              <div className="mt-2 p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
                <p className="text-sm font-medium text-red-400">
                  {discontinuedCount.toLocaleString()} discontinued fabrics found
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  Active on Twinbru: {activeIdsRef.current.length.toLocaleString()} &middot; In your catalogue: {discontinuedTotalInDb.toLocaleString()}
                </p>
                <button
                  onClick={deleteDiscontinued}
                  className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  Delete {discontinuedCount.toLocaleString()} discontinued fabrics
                </button>
              </div>
            )}

            <ResultBanner result={discontinuedResult} />
          </div>

          {(discontinuedState === 'idle' || discontinuedState === 'done') && (
            <button
              onClick={startDiscontinuedScan}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0 cursor-pointer"
            >
              <RefreshCw size={12} />
              {discontinuedState === 'done' ? 'Scan Again' : 'Find Discontinued'}
            </button>
          )}

          {discontinuedState === 'scanning' && (
            <span className="text-xs text-white/40 flex-shrink-0 pt-1">Scanning…</span>
          )}

          {discontinuedState === 'deleting' && (
            <span className="text-xs text-white/40 flex-shrink-0 pt-1">Deleting…</span>
          )}
        </div>
        {discontinuedState === 'scanning' && <ProgressBar running={true} />}
        {discontinuedState === 'deleting' && <ProgressBar running={true} />}
      </div>
    </div>
  )
}
