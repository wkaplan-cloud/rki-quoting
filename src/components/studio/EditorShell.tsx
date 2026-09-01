'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, FileDown, Printer, Check, Loader2, AlertTriangle, Images, ShoppingCart, Palette, PackageOpen, CloudUpload, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStudioStore } from '@/lib/studio/store'
import { preloadBgRemovalAssets } from '@/lib/studio/bgRemoval'
import { retryFailedImages } from '@/lib/studio/images'
import { persistLocal } from '@/lib/studio/store'
import { registerOfflineWorker } from '@/lib/studio/offlineRuntime'
import { processUploadQueue, refreshPendingCount } from '@/lib/studio/offlineUploads'
import type {
  StudioSlide,
  BoardLastState,
  StudioAsset,
  MasterLayoutConfig,
  StudioSpec,
  SpecSupplierOption,
} from '@/lib/studio/types'
import type { StudioObject } from '@/lib/studio/types'
import { SlidePanel } from './SlidePanel'
import { CanvasArea } from './CanvasArea'
import { AssetPanel } from './AssetPanel'
import { PiecesPanel } from './PiecesPanel'
import { SpecsPanel } from './SpecsPanel'
import { ProcurementPanel } from './ProcurementPanel'
import { RequestQuotesModal } from './RequestQuotesModal'
import { MasterThemePanel } from './MasterThemePanel'
import { PresentationMode } from './PresentationMode'
import { ExportRunner } from './ExportRunner'
import { PrintSlidesModal } from './PrintSlidesModal'

export interface EditorShellProps {
  boardId: string
  projectId: string | null
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  businessName: string
  logoUrl: string | null
  studioLogoUrl: string | null
  orgLogoUrl: string | null
  slides: StudioSlide[]
  assets: StudioAsset[]
  specs: StudioSpec[]
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]
  masterLayout: MasterLayoutConfig
  lastState: BoardLastState | null
}

export default function EditorShell(props: EditorShellProps) {
  const [ready, setReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [printPicker, setPrintPicker] = useState(false)
  const [printJob, setPrintJob] = useState<{ slideIds: string[]; win: Window | null } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [showPieces, setShowPieces] = useState(false)
  const [showProcurement, setShowProcurement] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const presenting = useStudioStore(s => s.presenting)
  const saveState = useStudioStore(s => s.saveState)
  const pendingUploads = useStudioStore(s => s.pendingUploads)
  // The board-wide specs list yields to the per-object spec editor while
  // it's open, and comes back when the editor closes
  const specEditorOpen = useStudioStore(s => !!s.specPanelObjectId)
  const selectedIds = useStudioStore(s => s.selectedIds)
  const boardAssets = useStudioStore(s => s.assets)
  const boardSizeLabel = useMemo(() => {
    const bytes = boardAssets.reduce((sum, a) => sum + a.fileSize, 0)
    if (bytes === 0) return null
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [boardAssets])

  // Whenever any specs UI is visible — the board-wide Procurement list, OR a
  // per-object Specs editor already open from an earlier click (which can
  // happen even while Assets or Theme is the active side panel, since that
  // editor isn't part of the same show/hide toggle) — selecting a single IMAGE
  // jumps straight to its spec editor. Specs only make sense on images (a
  // photo stands in for a physical product; text/shapes never get one), so
  // deselecting, multi-select, or selecting a non-image closes it instead.
  // Reacts to SELECTION and panel-toggle changes only — deliberately not to
  // the editor's own open state. With that in the deps, clicking the spec
  // editor's ✕ (openSpecs(null)) re-ran this effect, which saw the image
  // still selected and reopened the editor immediately — the ✕ appeared dead.
  useEffect(() => {
    const store = useStudioStore.getState()
    if (!showProcurement && !store.specPanelObjectId) return
    const slide = store.slides.find(sl => sl.id === store.currentSlideId)
    const obj = selectedIds.length === 1 ? slide?.objects.find(o => o.id === selectedIds[0]) : null
    store.openSpecs(obj?.type === 'image' ? obj.id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProcurement, selectedIds.join(',')])

  useEffect(() => {
    // One right-hand panel at a time — if more than one were somehow stored
    // open, Assets wins, then Procurement
    const assets = localStorage.getItem('studio-assets-open') === 'true'
    const procurement = !assets && localStorage.getItem('studio-procurement-open') === 'true'
    setShowAssets(assets)
    setShowProcurement(procurement)
    setShowTheme(!assets && !procurement && localStorage.getItem('studio-theme-open') === 'true')
  }, [])

  // Connectivity light. Edits keep working offline — everything stays in
  // memory, marked dirty, and syncs automatically on reconnect.
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Pictures that failed to load stay as grey frames forever on their own —
  // iPad Safari drops requests under memory pressure and on every wifi/cellular
  // hop. Retry them whenever the tab comes back to the foreground or the
  // connection returns, so the Refresh button is the fallback rather than the
  // only cure. A no-op when nothing failed.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible') retryFailedImages()
    }
    document.addEventListener('visibilitychange', retry)
    window.addEventListener('online', retry)
    return () => {
      document.removeEventListener('visibilitychange', retry)
      window.removeEventListener('online', retry)
    }
  }, [])

  // Unsaved work (typically while offline) — ask before leaving the page,
  // since unsynced changes live only in this tab
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const st = useStudioStore.getState()
      if (st.dirtySlideIds.length || st.dirtySpecIds.length || st.saveState !== 'saved') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Warm up the background-removal model silently while the user works.
  // Only surfaces the "Refining canvas" bar if there's a real download
  // happening (first visit on this device) — cached opens show nothing.
  const [refining, setRefining] = useState<number | null>(null)
  useEffect(() => {
    const started = Date.now()
    preloadBgRemovalAssets(fraction => {
      if (fraction === null) setRefining(null)
      else if (Date.now() - started > 500) setRefining(fraction)
    })
  }, [])

  function togglePanel(panel: 'assets' | 'pieces' | 'procurement' | 'theme') {
    const current = panel === 'assets' ? showAssets : panel === 'pieces' ? showPieces : panel === 'procurement' ? showProcurement : showTheme
    const next = !current
    const assets = panel === 'assets' ? next : false
    const pieces = panel === 'pieces' ? next : false
    const procurement = panel === 'procurement' ? next : false
    const theme = panel === 'theme' ? next : false
    setShowAssets(assets)
    setShowPieces(pieces)
    setShowProcurement(procurement)
    setShowTheme(theme)
    localStorage.setItem('studio-assets-open', String(assets))
    localStorage.setItem('studio-pieces-open', String(pieces))
    localStorage.setItem('studio-procurement-open', String(procurement))
    localStorage.setItem('studio-theme-open', String(theme))
    // Closing Procurement from the header must also close whichever per-object
    // Specs editor is open — otherwise clicking Procurement again to close it
    // leaves that panel lingering (it isn't gated by showProcurement itself)
    if (panel === 'procurement' && !procurement) useStudioStore.getState().openSpecs(null)
  }

  // Initialise the store from server data once, then put back anything an
  // earlier session on this device left unsynced (see store.hydrateFromLocal).
  // The editor renders straight away — recovery lands within a tick, before a
  // designer could realistically have made a competing edit.
  useEffect(() => {
    useStudioStore.getState().init(props)
    setReady(true)
    void useStudioStore.getState().hydrateFromLocal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.boardId])

  // Offline support: cache the board shell for a cold open with no signal, and
  // drain any images that were queued while the connection was down.
  useEffect(() => {
    registerOfflineWorker()
  }, [])

  useEffect(() => {
    void refreshPendingCount()
    void processUploadQueue()
    const drain = () => {
      void processUploadQueue()
    }
    window.addEventListener('online', drain)
    return () => window.removeEventListener('online', drain)
  }, [props.boardId])

  // Autosave reliability: flush when the tab hides / unmounts, when the
  // connection comes back, and on a 30s safety interval while dirty
  useEffect(() => {
    const flush = () => {
      void useStudioStore.getState().flushSave()
      // Mirror immediately as well: flushSave is a no-op when offline, and the
      // tab may be about to be evicted (iOS discards backgrounded tabs freely)
      void persistLocal()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const interval = setInterval(() => {
      const st = useStudioStore.getState()
      if (st.dirtySlideIds.length) flush()
      // iOS does not reliably fire `online` when it hops between wifi and
      // cellular, so the queue gets a periodic nudge too
      if (st.pendingUploads > 0) void processUploadQueue()
    }, 30000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', flush)
      flush()
    }
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useStudioStore.getState()
      if (store.presenting) return
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      const meta = e.metaKey || e.ctrlKey

      if (e.key === 'Escape') {
        if (typing) return // inputs handle their own Escape
        if (store.cropTargetId) store.setCropTarget(null)
        else if (store.editingTextId) store.setEditingText(null)
        else store.setSelected([])
        return
      }
      if (typing || store.editingTextId || store.editingHeading || store.cropTargetId) return

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        store.duplicateSelected()
      } else if (meta && e.key.toLowerCase() === 'c') {
        store.copySelection()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length) {
          e.preventDefault()
          store.deleteSelected()
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!store.selectedIds.length) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        const slide = store.slides.find(sl => sl.id === store.currentSlideId)
        const patches: { id: string; patch: Partial<StudioObject> }[] = []
        for (const id of store.selectedIds) {
          const obj = slide?.objects.find(o => o.id === id)
          if (obj && !obj.locked) patches.push({ id, patch: { x: obj.x + dx, y: obj.y + dy } })
        }
        if (patches.length) store.updateObjects(patches)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!ready) return null

  // Pulls the board down again: the asset library always, the slides too when
  // nothing is waiting to be saved (see store.refreshFromServer), plus a retry
  // of any picture whose bitmap failed to load.
  async function refreshBoard() {
    if (refreshing) return
    setRefreshing(true)
    const retried = retryFailedImages()
    try {
      const result = await useStudioStore.getState().refreshFromServer()
      if (!result.ok) {
        toast.error(
          navigator.onLine
            ? 'Could not refresh — please try again'
            : 'No connection — refresh once you are back online'
        )
      } else if (result.slidesSkipped) {
        toast.success(retried ? 'Images reloaded' : 'Assets up to date')
      } else {
        toast.success('Board refreshed')
      }
    } finally {
      setRefreshing(false)
    }
  }

  async function startPresent() {
    await useStudioStore.getState().flushSave()
    useStudioStore.getState().setPresenting(true)
  }

  return (
    // Sits above the app sidebar (z-50) — the canvas is the hero, full screen
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F5F2EC]">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 px-3 bg-[#1A1A18] flex-shrink-0">
        <Link
          href={`/studio/client/${props.clientId}`}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
        >
          <ArrowLeft size={14} /> Boards
        </Link>
        <div className="w-px h-4 bg-white/15" />
        <span className="text-sm text-white truncate">
          {props.clientName}
          <span className="text-white/40"> · {props.boardName}</span>
        </span>
        {boardSizeLabel && (
          <span className="text-[10px] text-white/30 whitespace-nowrap" title="Total size of images on this board">
            {boardSizeLabel}
          </span>
        )}

        <span className="ml-2 flex items-center gap-1 text-[10px] uppercase tracking-wider">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1 text-white/40">
              <Loader2 size={10} className="animate-spin" /> Saving
            </span>
          ) : saveState === 'error' ? (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle size={10} /> {online ? 'Not saved' : 'Saved on device'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-white/30">
              <Check size={10} /> Saved
            </span>
          )}
        </span>

        {pendingUploads > 0 && (
          <span
            className="ml-2 flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40"
            title="Images added offline — they upload automatically when the connection returns"
          >
            <CloudUpload size={10} /> {pendingUploads} queued
          </span>
        )}

        <span
          className="ml-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
          title={online ? 'Connected — changes save automatically' : 'Offline — your work is saved on this device and syncs when the connection returns'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={online ? 'text-white/30' : 'text-red-400'}>
            {online ? 'Online' : 'Offline'}
          </span>
        </span>

        <div className="flex-1" />

        {refining !== null && (
          <span className="flex items-center gap-2 mr-1" title="Preparing image tools (one-time download)">
            <span className="text-[10px] text-white/40 uppercase tracking-wider whitespace-nowrap">
              Refining canvas
            </span>
            <span className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
              <span
                className="block h-full bg-[#C4A46B] rounded-full origin-left transition-transform duration-300"
                style={{ transform: `scaleX(${refining})` }}
              />
            </span>
          </span>
        )}

        <button
          type="button"
          onClick={() => void refreshBoard()}
          disabled={refreshing}
          aria-label="Refresh board"
          title="Reload images and pull in anything added from another device"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} />
        </button>
        <button
          type="button"
          onClick={() => togglePanel('assets')}
          className={`flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg transition-colors cursor-pointer ${
            showAssets ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Project asset library"
        >
          <Images size={13} /> Assets
        </button>
        <button
          type="button"
          onClick={() => togglePanel('pieces')}
          className={`flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg transition-colors cursor-pointer ${
            showPieces ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Your catalog of specced pieces"
        >
          <PackageOpen size={13} /> Pieces
        </button>
        <button
          type="button"
          onClick={() => togglePanel('procurement')}
          className={`flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg transition-colors cursor-pointer ${
            showProcurement ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Every specced item on this board — request supplier quotes and build the quote"
        >
          <ShoppingCart size={13} /> Procurement
        </button>
        <button
          type="button"
          onClick={() => togglePanel('theme')}
          className={`flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg transition-colors cursor-pointer ${
            showTheme ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Master Page theme settings"
        >
          <Palette size={13} /> Theme
        </button>
        <button
          type="button"
          onClick={() => void startPresent()}
          className="flex items-center gap-1.5 h-8 px-3 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <Play size={13} /> Present
        </button>
        <button
          type="button"
          onClick={() => setPrintPicker(true)}
          disabled={exporting || printJob !== null}
          className="flex items-center gap-1.5 h-8 px-3 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <Printer size={13} /> Print
        </button>
        <button
          type="button"
          onClick={() => setExporting(true)}
          disabled={exporting}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
        >
          <FileDown size={13} /> {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <SlidePanel />
        <CanvasArea />
        {showAssets && <AssetPanel />}
        {showPieces && <PiecesPanel />}
        {showProcurement && !specEditorOpen && <ProcurementPanel />}
        {showTheme && <MasterThemePanel />}
        <SpecsPanel />
      </div>

      {presenting && <PresentationMode />}
      <RequestQuotesModal />{/* self-gates on store.rfqObjectIds */}
      {printPicker && (
        <PrintSlidesModal
          onCancel={() => setPrintPicker(false)}
          onPrint={(ids, win) => {
            setPrintPicker(false)
            setPrintJob({ slideIds: ids, win })
          }}
        />
      )}
      {printJob && (
        <ExportRunner
          mode="print"
          slideIds={printJob.slideIds}
          printWindow={printJob.win}
          onDone={() => setPrintJob(null)}
        />
      )}
      {exporting && <ExportRunner onDone={() => setExporting(false)} />}
    </div>
  )
}
