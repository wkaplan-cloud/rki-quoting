'use client'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Database, Trash2, Image } from 'lucide-react'

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
  lastDiscontinuedSync: SyncLog | null
  lastImageSync: SyncLog | null
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
  return <span className="text-white/40 tabular-nums">{m > 0 ? `${m}m ` : ''}{s}s</span>
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

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9A7B4F] mb-3">{children}</p>
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
    started_at: now,
    completed_at: now,
  }
}

async function safeFetch(url: string, cronSecret: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${cronSecret}` } })
  const rawText = await res.text()
  let data: Record<string, unknown> = {}
  try { data = rawText ? JSON.parse(rawText) : {} } catch { /* non-JSON */ }
  if (!res.ok && !data.error) data.error = rawText.slice(0, 200)
  return { ok: res.ok, data }
}

export function TwinbruSyncPanel({ lastPriceSync, lastLoadSync, lastDiscontinuedSync, lastImageSync, catalogueCount, cronSecret }: Props) {
  // ── Prices ──────────────────────────────────────────────────────────────────
  const [priceSyncLog, setPriceSyncLog] = useState<SyncLog | null>(lastPriceSync)
  const [triggeringPrices, setTriggeringPrices] = useState(false)
  const [priceResult, setPriceResult] = useState<SyncResult>(null)

  // ── Fabrics: Load ────────────────────────────────────────────────────────────
  const [loadSyncLog, setLoadSyncLog] = useState<SyncLog | null>(lastLoadSync)
  const [triggeringLoad, setTriggeringLoad] = useState(false)
  const [loadResult, setLoadResult] = useState<SyncResult>(null)
  const loadAddedRef = useRef(0)
  const loadCheckedRef = useRef(0)
  const loadRunningRef = useRef(false)
  const loadInvocationRef = useRef(0)

  // ── Fabrics: Discontinued ────────────────────────────────────────────────────
  type DiscontinuedState = 'idle' | 'scanning' | 'found' | 'deleting' | 'done'
  const [discontinuedState, setDiscontinuedState] = useState<DiscontinuedState>('idle')
  const [discontinuedResult, setDiscontinuedResult] = useState<SyncResult>(null)
  const [discontinuedCount, setDiscontinuedCount] = useState(0)
  const [discontinuedProductIds, setDiscontinuedProductIds] = useState<string[]>([])
  const [discontinuedTotalInDb, setDiscontinuedTotalInDb] = useState(0)
  const activeIdsRef = useRef<string[]>([])
  const discontinuedCurrentYearRef = useRef(0)

  // ── Images: Backfill ─────────────────────────────────────────────────────────
  const [triggeringImages, setTriggeringImages] = useState(false)
  const [imageResult, setImageResult] = useState<SyncResult>(null)

  // ── Price sync ───────────────────────────────────────────────────────────────
  async function triggerPriceSync() {
    setTriggeringPrices(true)
    setPriceResult(null)
    try {
      const { ok, data } = await safeFetch('/api/cron/sync-prices', cronSecret)
      if (!ok) { setPriceResult({ type: 'err', msg: String(data.error ?? 'Sync failed') }); return }
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

  // ── Load new fabrics ─────────────────────────────────────────────────────────
  async function triggerFullLoad() {
    loadRunningRef.current = true
    loadAddedRef.current = 0
    loadCheckedRef.current = 0
    loadInvocationRef.current = 0
    setTriggeringLoad(true)
    setLoadResult(null)
    await runLoadOnce()
  }

  async function runLoadOnce() {
    if (!loadRunningRef.current) return
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
      loadAddedRef.current  += (data.added   as number | null) ?? 0
      loadCheckedRef.current += (data.checked as number | null) ?? 0
      if (data.partial) {
        setLoadResult({ type: 'ok', msg: `Loading… ${loadCheckedRef.current.toLocaleString()} scanned, ${loadAddedRef.current.toLocaleString()} new fabrics added so far. Continuing in 10s…` })
        setTimeout(() => runLoadOnce(), 10_000)
      } else {
        setLoadResult({ type: 'ok', msg: `Complete — ${loadCheckedRef.current.toLocaleString()} scanned, ${loadAddedRef.current.toLocaleString()} new fabrics added` })
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

  // ── Remove discontinued ──────────────────────────────────────────────────────
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
    if (year > END_YEAR) { await compareWithDb(); return }
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
      setDiscontinuedResult({ type: 'ok', msg: `Scanning… year ${year} — ${activeIdsRef.current.length.toLocaleString()} active fabrics found so far` })
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
        setDiscontinuedResult({ type: 'ok', msg: `All ${d.totalInDb.toLocaleString()} fabrics are active on Twinbru. Nothing to remove.` })
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

  // ── Backfill images ──────────────────────────────────────────────────────────
  async function triggerImageBackfill() {
    setTriggeringImages(true)
    setImageResult(null)
    try {
      const { ok, data } = await safeFetch('/api/cron/sync-catalogue?backfill=true&trigger=manual', cronSecret)
      if (!ok) { setImageResult({ type: 'err', msg: String(data.error ?? 'Backfill failed') }); return }
      const total     = (data.total     as number | null) ?? 0
      const missing   = (data.missing   as number | null) ?? 0
      const populated = (data.populated as number | null) ?? 0
      setImageResult({ type: 'ok', msg: `Done — scanned ${total.toLocaleString()} fabrics · ${missing.toLocaleString()} had no image · ${populated.toLocaleString()} images populated` })
    } catch (e) {
      setImageResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setTriggeringImages(false)
    }
  }

  const priceSyncOk = priceSyncLog?.status === 'ok'

  return (
    <div className="bg-[#1A1A18] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Twinbru Sync</h2>
        <span className="text-xs text-white/30">{catalogueCount.toLocaleString()} fabrics in catalogue</span>
      </div>
      <p className="text-xs text-white/30 mb-6">All three syncs run automatically at 2am. Use the buttons below to trigger manually.</p>

      {/* ── Section 1: Fetch / Update Fabrics ── */}
      <div className="border-b border-white/10 pb-5 mb-5">
        <SectionLabel>Fetch / Update Fabrics</SectionLabel>

        {/* Load New Fabrics */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">Load New Fabrics</p>
                {triggeringLoad && <ElapsedTimer running={triggeringLoad} />}
              </div>
              <p className="text-xs text-white/30 mb-1">Scans Twinbru year by year and adds any fabrics not already in the catalogue. Existing fabrics and prices are never overwritten.</p>
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
            <button onClick={triggerFullLoad} disabled={triggeringLoad || discontinuedState === 'scanning' || discontinuedState === 'deleting'}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#9A7B4F]/20 hover:bg-[#9A7B4F]/30 text-[#C8A97A] transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed">
              <Database size={12} className={triggeringLoad ? 'animate-pulse' : ''} />
              {triggeringLoad ? 'Loading…' : 'Load New Fabrics'}
            </button>
          </div>
          <ProgressBar running={triggeringLoad} />
        </div>

        {/* Remove Discontinued */}
        <div>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">Remove Discontinued</p>
                {discontinuedState === 'scanning' && <ElapsedTimer running={true} />}
              </div>
              <p className="text-xs text-white/30 mb-1">Scans all active Twinbru fabrics and removes any from your catalogue that are no longer listed.</p>
              {lastDiscontinuedSync ? (
                <div className="mt-1 mb-2 space-y-0.5">
                  <p className="text-xs text-white/50">Last run: <span className="text-white/70">{fmt(lastDiscontinuedSync.completed_at ?? lastDiscontinuedSync.started_at)}</span></p>
                  {lastDiscontinuedSync.status === 'ok' && (
                    <p className="text-xs text-white/50">
                      {lastDiscontinuedSync.items_checked?.toLocaleString()} scanned &middot;{' '}
                      <span className="text-red-400">{lastDiscontinuedSync.items_added ?? 0} removed</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-white/40 mt-1 mb-2">Never run</p>
              )}

              {discontinuedState === 'found' && (
                <div className="mt-2 p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
                  <p className="text-sm font-medium text-red-400">{discontinuedCount.toLocaleString()} discontinued fabrics found</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Active on Twinbru: {activeIdsRef.current.length.toLocaleString()} &middot; In your catalogue: {discontinuedTotalInDb.toLocaleString()}
                  </p>
                  <button onClick={deleteDiscontinued}
                    className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer">
                    <Trash2 size={12} />
                    Delete {discontinuedCount.toLocaleString()} discontinued fabrics
                  </button>
                </div>
              )}
              <ResultBanner result={discontinuedResult} />
            </div>

            {(discontinuedState === 'idle' || discontinuedState === 'done') && (
              <button onClick={startDiscontinuedScan} disabled={triggeringLoad}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw size={12} />
                {discontinuedState === 'done' ? 'Scan Again' : 'Find Discontinued'}
              </button>
            )}
            {(discontinuedState === 'scanning' || discontinuedState === 'deleting') && (
              <span className="text-xs text-white/40 flex-shrink-0 pt-1">
                {discontinuedState === 'deleting' ? 'Deleting…' : 'Scanning…'}
              </span>
            )}
          </div>
          {(discontinuedState === 'scanning' || discontinuedState === 'deleting') && <ProgressBar running={true} />}
        </div>
      </div>

      {/* ── Section 2: Fetch / Update Prices ── */}
      <div className="border-b border-white/10 pb-5 mb-5">
        <SectionLabel>Fetch / Update Prices</SectionLabel>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Sync Prices</p>
              {triggeringPrices && <ElapsedTimer running={triggeringPrices} />}
            </div>
            <p className="text-xs text-white/30 mb-1">Updates the ZAR price on every fabric in the catalogue. Does not add or remove fabrics.</p>
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
            {triggeringPrices ? 'Syncing…' : 'Sync Prices'}
          </button>
        </div>
        <ProgressBar running={triggeringPrices} />
      </div>

      {/* ── Section 3: Fetch / Update Images ── */}
      <div>
        <SectionLabel>Fetch / Update Images</SectionLabel>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Backfill Images</p>
              {triggeringImages && <ElapsedTimer running={triggeringImages} />}
            </div>
            <p className="text-xs text-white/30 mb-1">Fetches and populates images for any fabrics in the catalogue that are missing an image URL. Safe to run at any time.</p>
            {lastImageSync ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-white/50">Last run: <span className="text-white/70">{fmt(lastImageSync.completed_at ?? lastImageSync.started_at)}</span></p>
                {lastImageSync.status === 'ok' && (
                  <p className="text-xs text-white/50">
                    {lastImageSync.items_checked?.toLocaleString()} scanned &middot;{' '}
                    <span className="text-emerald-400">{lastImageSync.items_added ?? 0} images populated</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-1">{triggeringImages ? 'Running…' : 'Never run'}</p>
            )}
            <ResultBanner result={imageResult} />
          </div>
          <button onClick={triggerImageBackfill} disabled={triggeringImages}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed">
            <Image size={12} className={triggeringImages ? 'animate-pulse' : ''} />
            {triggeringImages ? 'Running…' : 'Backfill Images'}
          </button>
        </div>
        <ProgressBar running={triggeringImages} />
      </div>
    </div>
  )
}
