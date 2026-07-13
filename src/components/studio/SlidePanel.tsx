'use client'
import { useEffect, useReducer, useRef, useState } from 'react'
import type Konva from 'konva'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Plus, Copy, Trash2, Pencil } from 'lucide-react'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { loadImage } from '@/lib/studio/images'
import type { StudioSlide } from '@/lib/studio/types'
import { StaticSlideStage } from './StaticSlideStage'

// Thumbnail bitmap cache. Slides are immutable (every edit produces a new
// object), so a WeakMap keyed on the slide reference invalidates itself; the
// key string catches page-number changes from reordering. With this, 100+
// slides show cached <img> thumbnails instead of 100 live canvases.
const thumbCache = new WeakMap<StudioSlide, { key: string; url: string }>()

const MIN_W = 148
const MAX_W = 320
const PANEL_KEY = 'studio-slide-panel-w'

export function SlidePanel() {
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const [width, setWidth] = useState(200)
  const [creating, setCreating] = useState(false)
  const dragging = useRef(false)

  useEffect(() => {
    const saved = Number(localStorage.getItem(PANEL_KEY))
    if (saved >= MIN_W && saved <= MAX_W) setWidth(saved)
  }, [])

  // Resize handle
  function onHandleDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    const startX = e.clientX
    const startW = width
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX))
      setWidth(w)
    }
    const up = () => {
      dragging.current = false
      setWidth(w => {
        localStorage.setItem(PANEL_KEY, String(w))
        return w
      })
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    useStudioStore.getState().reorderSlides(result.source.index, result.destination.index)
  }

  return (
    <div
      className="relative flex-shrink-0 h-full flex flex-col bg-[#F5F2EC] border-r border-[#D8D3C8]"
      style={{ width }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          Slides · {slides.length}
        </span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          title="New slide"
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer active:scale-95"
        >
          <Plus size={14} />
        </button>
      </div>

      {creating && (
        <NewSlideInput
          onDone={name => {
            setCreating(false)
            if (name.trim()) useStudioStore.getState().addSlide(name.trim())
          }}
        />
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="slides">
          {provided => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-2"
            >
              {slides.map((slide, i) => (
                <Draggable key={slide.id} draggableId={slide.id} index={i}>
                  {(drag, snapshot) => (
                    <div
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      {...drag.dragHandleProps}
                      style={drag.draggableProps.style}
                    >
                      <SlideThumbnail
                        slide={slide}
                        index={i}
                        count={slides.length}
                        active={slide.id === currentSlideId}
                        isDragging={snapshot.isDragging}
                        width={width - 20}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Resize handle */}
      <div
        onMouseDown={onHandleDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#9A7B4F]/30 transition-colors"
        title="Resize panel"
      />
    </div>
  )
}

function NewSlideInput({ onDone }: { onDone: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="px-2.5 pt-2">
      <input
        ref={ref}
        placeholder="Slide name"
        onBlur={e => onDone(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onDone((e.target as HTMLInputElement).value)
          if (e.key === 'Escape') onDone('')
        }}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
      />
    </div>
  )
}

// Shows the cached bitmap when available; otherwise waits until the
// thumbnail scrolls near the viewport, renders it once in a small live
// stage, snapshots it and caches the result.
function ThumbPreview({
  slide,
  index,
  count,
  width,
}: {
  slide: StudioSlide
  index: number
  count: number
  width: number
}) {
  const key = `${index + 1}/${count}/${Math.round(width)}`
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const boxRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setVisible(true)
      },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const cached = thumbCache.get(slide)
  const height = (width * PAGE_H) / PAGE_W

  return (
    <div ref={boxRef} style={{ width, height }} className="bg-white">
      {cached?.key === key ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cached.url} alt="" width={width} height={height} draggable={false} />
      ) : visible ? (
        <ThumbSnapshot
          slide={slide}
          index={index}
          count={count}
          width={width}
          onDone={url => {
            thumbCache.set(slide, { key, url })
            bump()
          }}
        />
      ) : null}
    </div>
  )
}

function ThumbSnapshot({
  slide,
  index,
  count,
  width,
  onDone,
}: {
  slide: StudioSlide
  index: number
  count: number
  width: number
  onDone: (url: string) => void
}) {
  const stageRef = useRef<Konva.Stage | null>(null)

  useEffect(() => {
    let cancelled = false
    const urls = slide.objects.flatMap(o => (o.type === 'image' ? [o.url] : []))
    const logoUrl = useStudioStore.getState().logoUrl
    if (logoUrl) urls.push(logoUrl)
    Promise.allSettled(urls.map(loadImage)).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (cancelled) return
          const stage = stageRef.current
          if (!stage) return
          try {
            onDone(stage.toDataURL({ pixelRatio: 2 }))
          } catch {
            // snapshot failed — the live stage stays visible, no harm done
          }
        })
      )
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, index, count, width])

  return (
    <StaticSlideStage
      slide={slide}
      pageNumber={index + 1}
      pageCount={count}
      width={width}
      stageRef={stageRef}
    />
  )
}

function SlideThumbnail({
  slide,
  index,
  count,
  active,
  isDragging,
  width,
}: {
  slide: StudioSlide
  index: number
  count: number
  active: boolean
  isDragging: boolean
  width: number
}) {
  const [renaming, setRenaming] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus()
      renameRef.current?.select()
    }
  }, [renaming])

  function commitRename() {
    const value = renameRef.current?.value.trim()
    if (value && value !== slide.name) useStudioStore.getState().renameSlide(slide.id, value)
    setRenaming(false)
  }

  function onDelete() {
    if (count <= 1) return
    if (confirm(`Delete slide "${slide.name}"?`)) {
      useStudioStore.getState().deleteSlide(slide.id)
    }
  }

  return (
    <div
      onClick={() => useStudioStore.getState().setCurrentSlide(slide.id)}
      className={`group/slide rounded-lg p-1.5 cursor-pointer transition-colors
        ${active ? 'bg-[#9A7B4F]/15 ring-1 ring-[#9A7B4F]' : 'hover:bg-[#EDE9E1]'}
        ${isDragging ? 'shadow-xl' : ''}`}
    >
      <div className="rounded overflow-hidden border border-[#D8D3C8] bg-white pointer-events-none">
        <ThumbPreview slide={slide} index={index} count={count} width={width - 12} />
      </div>
      <div className="flex items-center gap-1 mt-1 min-h-[20px]">
        <span className="text-[10px] text-[#8A877F] w-4 text-center flex-shrink-0">{index + 1}</span>
        {renaming ? (
          <input
            ref={renameRef}
            defaultValue={slide.name}
            onClick={e => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="flex-1 min-w-0 text-[11px] px-1 py-0.5 rounded border border-[#9A7B4F] bg-white outline-none text-[#2C2C2A]"
          />
        ) : (
          <>
            <span
              className="flex-1 min-w-0 truncate text-[11px] text-[#2C2C2A]"
              onDoubleClick={e => {
                e.stopPropagation()
                setRenaming(true)
              }}
            >
              {slide.name}
            </span>
            <span className="hidden group-hover/slide:flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                title="Rename"
                onClick={e => {
                  e.stopPropagation()
                  setRenaming(true)
                }}
                className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-white transition-colors cursor-pointer"
              >
                <Pencil size={10} />
              </button>
              <button
                type="button"
                title="Duplicate"
                onClick={e => {
                  e.stopPropagation()
                  useStudioStore.getState().duplicateSlide(slide.id)
                }}
                className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] hover:bg-white transition-colors cursor-pointer"
              >
                <Copy size={10} />
              </button>
              {count > 1 && (
                <button
                  type="button"
                  title="Delete"
                  onClick={e => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded text-[#8A877F] hover:text-red-600 hover:bg-white transition-colors cursor-pointer"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
