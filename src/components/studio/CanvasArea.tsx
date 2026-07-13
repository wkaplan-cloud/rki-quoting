'use client'
import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import toast from 'react-hot-toast'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { extractImageFiles, importImageFiles } from '@/lib/studio/images'
import { CanvasStage } from './CanvasStage'
import { FloatingToolbar } from './FloatingToolbar'
import { InsertBar } from './InsertBar'
import { TextEditOverlay, HeadingEditOverlay } from './TextEditOverlay'

// Owns the viewport chrome: container sizing, initial fit, space-drag panning,
// Finder drag & drop, clipboard paste, and the DOM overlays.
export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [panMode, setPanMode] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const viewportRestored = useStudioStore(s => s.viewportRestored)

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // First open (no saved state): fit the page in the container, centred
  useEffect(() => {
    if (viewportRestored || size.w === 0 || size.h === 0) return
    const zoom = Math.min((size.w - 96) / PAGE_W, (size.h - 120) / PAGE_H)
    useStudioStore.setState({
      viewport: { zoom, x: (size.w - PAGE_W * zoom) / 2, y: (size.h - PAGE_H * zoom) / 2 + 16 },
      viewportRestored: true,
    })
  }, [viewportRestored, size])

  // Space held = pan mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      e.preventDefault()
      setPanMode(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setPanMode(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Paste: image files import; otherwise internal object paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((f): f is File => !!f)
      if (files.length) {
        e.preventDefault()
        void toast.promise(importImageFiles(files), {
          loading: 'Pasting image…',
          success: 'Image added',
          error: (err: Error) => err.message || 'Paste failed',
        })
      } else {
        useStudioStore.getState().paste()
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function pagePointFromClient(clientX: number, clientY: number) {
    const el = containerRef.current
    const { viewport } = useStudioStore.getState()
    const rect = el?.getBoundingClientRect()
    const sx = clientX - (rect?.left ?? 0)
    const sy = clientY - (rect?.top ?? 0)
    return { x: (sx - viewport.x) / viewport.zoom, y: (sy - viewport.y) / viewport.zoom }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = extractImageFiles(e.dataTransfer)
    if (!files.length) return
    const at = pagePointFromClient(e.clientX, e.clientY)
    void toast.promise(importImageFiles(files, at), {
      loading: files.length > 1 ? `Importing ${files.length} images…` : 'Importing image…',
      success: files.length > 1 ? 'Images arranged on slide' : 'Image added',
      error: (err: Error) => err.message || 'Import failed',
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 overflow-hidden bg-[#EDE9E1]"
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={e => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false)
        }
      }}
      onDrop={onDrop}
    >
      {size.w > 0 && <CanvasStage size={size} panMode={panMode} stageRef={stageRef} />}
      <InsertBar />
      <FloatingToolbar stageRef={stageRef} containerSize={size} />
      <TextEditOverlay />
      <HeadingEditOverlay />
      {dragOver && (
        <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-[#9A7B4F] bg-[#9A7B4F]/5 flex items-center justify-center">
          <span className="bg-white text-[#2C2C2A] text-sm px-4 py-2 rounded-full shadow-lg">
            Drop images or PDFs to add them to this slide
          </span>
        </div>
      )}
    </div>
  )
}
