'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, FileDown, Check, Loader2, AlertTriangle } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { StudioSlide, BoardLastState } from '@/lib/studio/types'
import type { StudioObject } from '@/lib/studio/types'
import { SlidePanel } from './SlidePanel'
import { CanvasArea } from './CanvasArea'
import { PresentationMode } from './PresentationMode'
import { ExportRunner } from './ExportRunner'

export interface EditorShellProps {
  boardId: string
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  businessName: string
  logoUrl: string | null
  slides: StudioSlide[]
  lastState: BoardLastState | null
}

export default function EditorShell(props: EditorShellProps) {
  const [ready, setReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const presenting = useStudioStore(s => s.presenting)
  const saveState = useStudioStore(s => s.saveState)

  // Initialise the store from server data once
  useEffect(() => {
    useStudioStore.getState().init(props)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.boardId])

  // Flush pending saves when the tab hides or the editor unmounts
  useEffect(() => {
    const flush = () => {
      void useStudioStore.getState().flushSave()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
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

        <span className="ml-2 flex items-center gap-1 text-[10px] uppercase tracking-wider">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1 text-white/40">
              <Loader2 size={10} className="animate-spin" /> Saving
            </span>
          ) : saveState === 'error' ? (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle size={10} /> Not saved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-white/30">
              <Check size={10} /> Saved
            </span>
          )}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => void startPresent()}
          className="flex items-center gap-1.5 h-8 px-3 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <Play size={13} /> Present
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
      </div>

      {presenting && <PresentationMode />}
      {exporting && <ExportRunner onDone={() => setExporting(false)} />}
    </div>
  )
}
