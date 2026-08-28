'use client'
import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import toast from 'react-hot-toast'
import { PAGE_W, PAGE_H, OBJECT_DEFAULTS, DEFAULT_FONT, STUDIO_CLIPBOARD_PREFIX } from '@/lib/studio/constants'
import { useStudioStore, newId } from '@/lib/studio/store'
import type { StudioObject, StudioAsset } from '@/lib/studio/types'
import { extractImageFiles, importImageFiles, importImageFromUrl, addAssetToSlide, registerAssetsOnBoard } from '@/lib/studio/images'
import { ASSET_DRAG_TYPE } from './AssetPanel'
import { PIECE_DRAG_TYPE } from './PiecesPanel'
import { addPieceToSlide } from '@/lib/studio/pieces'
import { fitViewport, centreViewport, zoomAtCentre, nextZoomUp, nextZoomDown } from '@/lib/studio/viewport'
import { CanvasStage } from './CanvasStage'
import { FloatingToolbar } from './FloatingToolbar'
import { ZoomControl } from './ZoomControl'
import { InsertBar } from './InsertBar'
import { TextEditOverlay, HeadingEditOverlay } from './TextEditOverlay'

// Owns the viewport chrome: container sizing, initial fit, space-drag panning,
// Finder drag & drop, clipboard paste, and the DOM overlays.
export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [handTool, setHandTool] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Hold Space for a momentary pan; the hand tool latches it on
  const panMode = spaceDown || handTool
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
    useStudioStore.setState({ viewport: fitViewport(size), viewportRestored: true })
  }, [viewportRestored, size])

  // Viewport keys: Space held = momentary pan, V/H switch tool, ⌘± / ⌘0 / ⌘1
  // zoom. These live here rather than in EditorShell because fitting the page
  // needs the container size.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const store = useStudioStore.getState()
      if (store.presenting) return
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      if (typing || store.editingTextId || store.editingHeading) return

      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceDown(true)
        return
      }
      if (e.metaKey || e.ctrlKey) {
        // '=' is the unshifted ⌘+ on most layouts
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          store.setViewport(zoomAtCentre(store.viewport, nextZoomUp(store.viewport.zoom), size))
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          store.setViewport(zoomAtCentre(store.viewport, nextZoomDown(store.viewport.zoom), size))
        } else if (e.key === '0') {
          e.preventDefault()
          store.setViewport(fitViewport(size))
        } else if (e.key === '1') {
          e.preventDefault()
          store.setViewport(centreViewport(1, size))
        }
        return
      }
      if (e.key === 'v' || e.key === 'V') setHandTool(false)
      else if (e.key === 'h' || e.key === 'H') setHandTool(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    // A drag that leaves the window swallows the keyup — never leave it stuck
    const blur = () => setSpaceDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [size])

  // Paste, in priority order: image files import; studio objects copied on
  // this or another board (prefixed JSON — see copySelection); any other
  // text becomes a text object; otherwise the in-memory object clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((f): f is File => !!f)
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (files.length) {
        e.preventDefault()
        void toast.promise(importImageFiles(files), {
          loading: 'Pasting image…',
          success: 'Image added',
          error: (err: Error) => err.message || 'Paste failed',
        })
      } else if (text.startsWith(STUDIO_CLIPBOARD_PREFIX)) {
        e.preventDefault()
        try {
          const raw = JSON.parse(text.slice(STUDIO_CLIPBOARD_PREFIX.length)) as
            | StudioObject[]
            | { objects: StudioObject[]; assets?: StudioAsset[] }
          const payload = Array.isArray(raw) ? { objects: raw, assets: undefined } : raw
          useStudioStore.getState().pasteObjects(payload.objects)
          // Cross-board paste: register the images in this board's asset
          // library too (background, non-blocking)
          if (payload.assets?.length) void registerAssetsOnBoard(payload.assets)
        } catch {
          useStudioStore.getState().paste()
        }
      } else if (text.trim()) {
        e.preventDefault()
        useStudioStore.getState().addObjects([
          {
            id: newId(),
            type: 'text',
            x: PAGE_W / 2 - 150,
            y: PAGE_H / 2 - 16,
            rotation: 0,
            opacity: 1,
            locked: false,
            width: 300,
            text: text.trim(),
            fontSize: OBJECT_DEFAULTS.fontSize,
            fontFamily: DEFAULT_FONT,
            fontStyle: 'normal',
            textDecoration: '',
            fill: OBJECT_DEFAULTS.textFill,
            align: 'left',
          },
        ])
      } else {
        // Nothing the sync clipboard API could read. Native apps (Keynote,
        // Preview…) often put images on the clipboard in Apple formats the
        // paste event doesn't surface — the async API converts those to PNG
        // where the browser can, so try it before giving up.
        void (async () => {
          try {
            const items = await navigator.clipboard.read()
            const pasted: File[] = []
            for (const item of items) {
              const type = item.types.find(ty => ty.startsWith('image/'))
              if (!type) continue
              const blob = await item.getType(type)
              pasted.push(new File([blob], `pasted.${type.split('/')[1] ?? 'png'}`, { type }))
            }
            if (pasted.length) {
              await toast.promise(importImageFiles(pasted), {
                loading: 'Pasting image…',
                success: 'Image added',
                error: (err: Error) => err.message || 'Paste failed',
              })
              return
            }
          } catch (err) {
            if ((err as DOMException)?.name === 'NotAllowedError') {
              toast.error(
                'Clipboard access is blocked for this site — click the padlock in the address bar, allow Clipboard, then paste again'
              )
              return
            }
            // API unavailable / unreadable clipboard — fall through
          }
          const { clipboard } = useStudioStore.getState()
          if (clipboard.length) {
            useStudioStore.getState().paste()
          } else {
            // Apps like Keynote copy in Apple-only formats the browser can't
            // read at all — a clipboard screenshot always works instead
            toast.error(
              'Couldn’t read an image from the clipboard. Tip: screenshot it with ctrl+shift+cmd+4, then paste again',
              { duration: 6000 }
            )
          }
        })()
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
    // Asset Library drag — the file is already stored, just place it
    const assetData = e.dataTransfer.getData(ASSET_DRAG_TYPE)
    if (assetData) {
      try {
        addAssetToSlide(JSON.parse(assetData), pagePointFromClient(e.clientX, e.clientY))
      } catch {
        // malformed drag payload — ignore
      }
      return
    }
    // Pieces catalog drag — places the image + a pre-filled spec
    const pieceData = e.dataTransfer.getData(PIECE_DRAG_TYPE)
    if (pieceData) {
      try {
        const piece = JSON.parse(pieceData)
        void addPieceToSlide(piece, pagePointFromClient(e.clientX, e.clientY)).catch(err => {
          toast.error(err.message || 'Could not place this piece')
        })
      } catch {
        // malformed drag payload — ignore
      }
      return
    }
    const files = extractImageFiles(e.dataTransfer)
    const at = pagePointFromClient(e.clientX, e.clientY)
    if (files.length) {
      void toast.promise(importImageFiles(files, at), {
        loading: files.length > 1 ? `Importing ${files.length} images…` : 'Importing image…',
        success: files.length > 1 ? 'Images arranged on slide' : 'Image added',
        error: (err: Error) => err.message || 'Import failed',
      })
      return
    }
    // No file — an image dragged from a web page arrives as HTML/URL data
    const html = e.dataTransfer.getData('text/html')
    const htmlSrc = html
      ? new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.src ?? ''
      : ''
    const firstUri = (e.dataTransfer.getData('text/uri-list').split('\n')[0] ?? '').trim()
    const url = htmlSrc || (/^(https?:|data:image\/)/i.test(firstUri) ? firstUri : '')
    if (!url) return
    void toast.promise(importImageFromUrl(url, at), {
      loading: 'Importing image…',
      success: 'Image added',
      error: () =>
        'That site doesn’t allow direct import — save the image first, then drag the file in',
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-0 overflow-hidden bg-[#EDE9E1]"
      onDragOver={e => {
        if (e.dataTransfer.types.includes(ASSET_DRAG_TYPE) || e.dataTransfer.types.includes(PIECE_DRAG_TYPE)) {
          e.preventDefault() // allow the drop without the "drop files" chrome
        } else if (
          e.dataTransfer.types.includes('Files') ||
          e.dataTransfer.types.includes('text/uri-list') ||
          e.dataTransfer.types.includes('text/html')
        ) {
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
      <ZoomControl size={size} handTool={handTool} onHandToolChange={setHandTool} />
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
