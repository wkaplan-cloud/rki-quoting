'use client'
import { useEffect, useRef, useState } from 'react'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { useStudioStore } from '@/lib/studio/store'
import { loadImage } from '@/lib/studio/images'
import { StaticSlideStage } from './StaticSlideStage'

// Fullscreen, chrome-free presentation. Arrow keys / space navigate; Escape
// (or leaving fullscreen) exits.
export function PresentationMode() {
  const slides = useStudioStore(s => s.slides)
  const currentSlideId = useStudioStore(s => s.currentSlideId)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const index = Math.max(0, slides.findIndex(sl => sl.id === currentSlideId))
  const slide = slides[index]

  useEffect(() => {
    const el = containerRef.current
    el?.requestFullscreen?.().catch(() => {})
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) useStudioStore.getState().setPresenting(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Preload the neighbouring slides' images so arrow-key navigation is
  // instant even on 100+ slide boards
  useEffect(() => {
    for (const neighbour of [slides[index + 1], slides[index - 1]]) {
      neighbour?.objects.forEach(o => {
        if (o.type === 'image') void loadImage(o.url).catch(() => {})
      })
    }
  }, [index, slides])

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useStudioStore.getState()
      const i = Math.max(0, store.slides.findIndex(sl => sl.id === store.currentSlideId))
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        const next = store.slides[i + 1]
        if (next) store.setCurrentSlide(next.id)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        const prev = store.slides[i - 1]
        if (prev) store.setCurrentSlide(prev.id)
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        // Fullscreen was refused — Escape still exits
        store.setPresenting(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!slide) return null

  const width = Math.min(size.w, (size.h * PAGE_W) / PAGE_H)

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-none"
      onClick={() => {
        const store = useStudioStore.getState()
        const next = store.slides[index + 1]
        if (next) store.setCurrentSlide(next.id)
      }}
    >
      {size.w > 0 && (
        <StaticSlideStage slide={slide} pageNumber={index + 1} pageCount={slides.length} width={width} />
      )}
    </div>
  )
}
