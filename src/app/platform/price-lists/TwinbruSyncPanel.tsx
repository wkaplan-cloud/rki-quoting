'use client'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Database } from 'lucide-react'

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

export function TwinbruSyncPanel({ lastPriceSync, lastCatalogueSync, catalogueCount, cronSecret }: Props) {
  const [priceSyncLog, setPriceSyncLog] = useState<SyncLog | null>(lastPriceSync)
  const [catalogueSyncLog, setCatalogueSyncLog] = useState<SyncLog | null>(lastCatalogueSync)

  const [triggeringPrices, setTriggeringPrices] = useState(false)
  const [triggeringCatalogue, setTriggeringCatalogue] = useState(false)
  const [triggeringLoad, setTriggeringLoad] = useState(false)

  const [priceResult, setPriceResult] = useState<SyncResult>(null)
  const [catalogueResult, setCatalogueResult] = useState<SyncResult>(null)
  const [loadResult, setLoadResult] = useState<SyncResult>(null)

  // Tracks total fabrics added across all auto-continue runs for the load
  const loadAddedRef = useRef(0)
  const loadCheckedRef = useRef(0)
  const catalogueAddedRef = useRef(0)
  const catalogueCheckedRef = useRef(0)

  // Allows cancelling auto-continue if user navigates away
  const loadRunningRef = useRef(false)
  const catalogueRunningRef = useRef(false)

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

  // Catalogue sync — auto-continues on partial runs without user pressing the button again
  async function triggerCatalogueSync() {
    catalogueRunningRef.current = true
    catalogueAddedRef.current = 0
    catalogueCheckedRef.current = 0
    setTriggeringCatalogue(true)
    setCatalogueResult(null)
    await runCatalogueOnce()
  }

  async function runCatalogueOnce() {
    if (!catalogueRunningRef.current) return
    try {
      const { ok, data } = await safeFetch('/api/cron/sync-catalogue?trigger=manual', cronSecret)
      if (!ok) {
        setCatalogueResult({ type: 'err', msg: String(data.error ?? 'Sync failed') })
        catalogueRunningRef.current = false
        setTriggeringCatalogue(false)
        return
      }
      catalogueAddedRef.current += (data.added as number | null) ?? 0
      catalogueCheckedRef.current += (data.checked as number | null) ?? 0
      if (data.partial) {
        setCatalogueResult({ type: 'ok', msg: `Running… ${catalogueCheckedRef.current.toLocaleString()} scanned, ${catalogueAddedRef.current} new fabrics so far. Continuing in 10s…` })
        setCatalogueSyncLog(prev => makeLog({ ...(prev ?? {}), sync_type: 'catalogue', items_checked: catalogueCheckedRef.current, items_added: catalogueAddedRef.current }))
        setTimeout(() => runCatalogueOnce(), 10_000)
      } else {
        setCatalogueResult({ type: 'ok', msg: `Done — ${catalogueCheckedRef.current.toLocaleString()} scanned, ${catalogueAddedRef.current} new fabrics added` })
        setCatalogueSyncLog(prev => makeLog({ ...(prev ?? {}), sync_type: 'catalogue', items_checked: catalogueCheckedRef.current, items_added: catalogueAddedRef.current }))
        catalogueRunningRef.current = false
        setTriggeringCatalogue(false)
      }
    } catch (e) {
      setCatalogueResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      catalogueRunningRef.current = false
      setTriggeringCatalogue(false)
    }
  }

  // Full load via POST /products/search — auto-continues across years/pages
  async function triggerFullLoad() {
    loadRunningRef.current = true
    loadAddedRef.current = 0
    loadCheckedRef.current = 0
    setTriggeringLoad(true)
    setLoadResult(null)
    await runLoadOnce()
  }

  async function runLoadOnce() {
    if (!loadRunningRef.current) return
    try {
      const { ok, data } = await safeFetch('/api/cron/load-catalogue?trigger=manual', cronSecret)
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
        loadRunningRef.current = false
        setTriggeringLoad(false)
      }
    } catch (e) {
      setLoadResult({ type: 'err', msg: e instanceof Error ? e.message : 'Unknown error' })
      loadRunningRef.current = false
      setTriggeringLoad(false)
    }
  }

  const priceSyncOk = priceSyncLog?.status === 'ok'
  const catalogueSyncOk = catalogueSyncLog?.status === 'ok'
  const catalogueAge = daysSince(catalogueSyncLog?.completed_at ?? null)

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

      {/* Catalogue Change Sync (ODS changefeed — picks up discontinued items etc) */}
      <div className="py-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">Catalogue Changes</p>
              {triggeringCatalogue && <ElapsedTimer running={triggeringCatalogue} />}
            </div>
            <p className="text-xs text-white/30 mb-1">Checks Twinbru for fabrics that have been discontinued since the last sync and marks them accordingly. Does not add new fabrics or update prices.</p>
            {catalogueSyncLog ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-white/50">Last run: <span className="text-white/70">{fmt(catalogueSyncLog.completed_at ?? catalogueSyncLog.started_at)}</span></p>
                {catalogueSyncOk ? (
                  <p className="text-xs text-white/50">
                    {catalogueSyncLog.items_checked?.toLocaleString()} scanned &middot;{' '}
                    <span className="text-emerald-400">{catalogueSyncLog.items_added ?? 0} new</span>
                  </p>
                ) : !catalogueSyncLog.completed_at ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={11} /> Did not complete — will resume automatically tonight.</p>
                ) : (
                  <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {catalogueSyncLog.error_message?.slice(0, 160) ?? 'Failed'}</p>
                )}
                {catalogueAge != null && catalogueAge > 30 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1 mt-1"><Clock size={11} /> {catalogueAge} days since last sync</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-1">{triggeringCatalogue ? 'Running…' : 'Never run'}</p>
            )}
            <ResultBanner result={catalogueResult} />
          </div>
          <button onClick={triggerCatalogueSync} disabled={triggeringCatalogue}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed">
            <RefreshCw size={12} className={triggeringCatalogue ? 'animate-spin' : ''} />
            {triggeringCatalogue ? 'Running…' : 'Sync Changes'}
          </button>
        </div>
        <ProgressBar running={triggeringCatalogue} />
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
    </div>
  )
}
