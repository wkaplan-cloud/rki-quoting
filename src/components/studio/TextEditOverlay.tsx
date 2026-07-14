'use client'
import { useEffect, useRef } from 'react'
import { PAGE_W } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { getMasterTheme, getMasterMarginRect } from '@/lib/studio/masterThemes'
import type { TextObject } from '@/lib/studio/types'

// Konva can't edit text in-canvas — this HTML textarea sits exactly over the
// text node (un-rotated while editing) and commits on blur / Escape / ⌘Enter.
export function TextEditOverlay() {
  const editingTextId = useStudioStore(s => s.editingTextId)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const slides = useStudioStore(s => s.slides)
  const viewport = useStudioStore(s => s.viewport)

  const slide = slides.find(sl => sl.id === currentSlideId)
  const obj = slide?.objects.find(o => o.id === editingTextId && o.type === 'text') as
    | TextObject
    | undefined

  if (!obj) return null
  return <TextEditor key={obj.id} obj={obj} zoom={viewport.zoom} panX={viewport.x} panY={viewport.y} />
}

function TextEditor({ obj, zoom, panX, panY }: { obj: TextObject; zoom: number; panX: number; panY: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  function commit() {
    const value = ref.current?.value ?? ''
    const store = useStudioStore.getState()
    if (value.trim() === '') {
      // Empty text objects are just deleted
      store.setSelected([obj.id])
      store.setEditingText(null)
      store.deleteSelected()
      return
    }
    if (value !== obj.text) store.updateObject(obj.id, { text: value })
    store.setEditingText(null)
  }

  return (
    <textarea
      ref={ref}
      defaultValue={obj.text}
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          commit()
        }
      }}
      spellCheck={false}
      className="absolute z-30 resize-none overflow-hidden bg-transparent outline-none border border-dashed border-[#9A7B4F]"
      style={{
        left: panX + obj.x * zoom,
        top: panY + obj.y * zoom,
        width: Math.max(40, obj.width * zoom + 8),
        minHeight: obj.fontSize * 1.3 * zoom + 8,
        fontSize: obj.fontSize * zoom,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontStyle.includes('bold') ? 700 : 400,
        fontStyle: obj.fontStyle.includes('italic') ? 'italic' : 'normal',
        textDecoration: obj.textDecoration,
        color: obj.fill,
        textAlign: obj.align,
        lineHeight: 1.3,
      }}
    />
  )
}

// Same idea for the master-layout slide heading (a slide field, not an object)
export function HeadingEditOverlay() {
  const editingHeading = useStudioStore(s => s.editingHeading)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const slides = useStudioStore(s => s.slides)
  const viewport = useStudioStore(s => s.viewport)
  const masterLayout = useStudioStore(s => s.masterLayout)
  const inputRef = useRef<HTMLInputElement>(null)

  const slide = slides.find(sl => sl.id === currentSlideId)

  useEffect(() => {
    if (editingHeading) inputRef.current?.focus()
  }, [editingHeading])

  if (!editingHeading || !slide) return null

  function commit() {
    const value = inputRef.current?.value ?? ''
    const store = useStudioStore.getState()
    if (slide && value !== slide.heading) store.setHeading(slide.id, value)
    store.setEditingHeading(false)
  }

  // Mirrors exactly what MasterGroup renders for the heading so this HTML
  // edit box never visually drifts from the canvas text
  const theme = getMasterTheme(masterLayout.themeId)
  const margin = getMasterMarginRect(masterLayout)
  const width = PAGE_W - margin.left - margin.right

  return (
    <input
      ref={inputRef}
      defaultValue={slide.heading}
      placeholder="Slide heading"
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          commit()
        }
      }}
      className="absolute z-30 bg-transparent outline-none border-b border-dashed border-[#9A7B4F]"
      style={{
        left: viewport.x + margin.left * viewport.zoom,
        top: viewport.y + margin.top * viewport.zoom,
        width: width * viewport.zoom,
        fontSize: theme.header.fontSizePt * viewport.zoom,
        fontFamily: theme.header.fontVar === '--font-playfair' ? 'var(--font-playfair)' : 'var(--font-inter)',
        fontStyle: theme.header.fontStyle,
        letterSpacing: theme.header.uppercase ? theme.header.letterSpacing : undefined,
        textTransform: theme.header.uppercase ? 'uppercase' : undefined,
        color: theme.header.color,
      }}
    />
  )
}
