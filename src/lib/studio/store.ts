'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { StudioObject, StudioSlide, BoardLastState } from './types'
import { MAX_HISTORY, SAVE_DEBOUNCE, STATE_SAVE_DEBOUNCE } from './constants'

interface Snapshot {
  slides: StudioSlide[]
  currentSlideId: string
}

export interface Viewport {
  zoom: number
  x: number
  y: number
}

interface InitProps {
  boardId: string
  orgId: string
  projectId: string
  projectName: string
  businessName: string
  logoUrl: string | null
  slides: StudioSlide[]
  lastState: BoardLastState | null
}

interface StudioState {
  boardId: string
  orgId: string
  projectId: string
  projectName: string
  businessName: string
  logoUrl: string | null

  slides: StudioSlide[]
  currentSlideId: string
  selectedIds: string[]
  editingTextId: string | null
  editingHeading: boolean
  cropTargetId: string | null
  viewport: Viewport
  viewportRestored: boolean
  clipboard: StudioObject[]
  guides: { v: number[]; h: number[] }
  presenting: boolean
  exporting: boolean

  past: Snapshot[]
  future: Snapshot[]
  dirtySlideIds: string[]
  saveState: 'saved' | 'saving' | 'error'

  init: (props: InitProps) => void
  setCurrentSlide: (id: string) => void
  setSelected: (ids: string[]) => void
  setEditingText: (id: string | null) => void
  setEditingHeading: (on: boolean) => void
  setCropTarget: (id: string | null) => void
  setViewport: (v: Viewport) => void
  setGuides: (g: { v: number[]; h: number[] }) => void
  setPresenting: (on: boolean) => void

  commit: (mutate: (slides: StudioSlide[]) => StudioSlide[]) => void
  // Object helpers (all operate on the current slide unless a slideId is given)
  updateObject: (objId: string, patch: Partial<StudioObject>) => void
  updateObjects: (patches: { id: string; patch: Partial<StudioObject> }[]) => void
  addObjects: (objs: StudioObject[], slideId?: string) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  bringForward: (objId: string) => void
  sendBack: (objId: string) => void
  copySelection: () => void
  paste: () => void
  // Slide helpers
  addSlide: (name: string) => void
  renameSlide: (id: string, name: string) => void
  setHeading: (id: string, heading: string) => void
  duplicateSlide: (id: string) => void
  deleteSlide: (id: string) => void
  reorderSlides: (from: number, to: number) => void

  undo: () => void
  redo: () => void

  flushSave: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let stateTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void useStudioStore.getState().flushSave()
  }, SAVE_DEBOUNCE)
}

function scheduleStateSave() {
  if (stateTimer) clearTimeout(stateTimer)
  stateTimer = setTimeout(() => {
    stateTimer = null
    void saveLastState()
  }, STATE_SAVE_DEBOUNCE)
}

async function saveLastState() {
  const s = useStudioStore.getState()
  if (!s.boardId) return
  const lastState: BoardLastState = {
    slideId: s.currentSlideId || null,
    zoom: s.viewport.zoom,
    panX: s.viewport.x,
    panY: s.viewport.y,
  }
  const supabase = createClient()
  await supabase
    .from('studio_boards')
    .update({ last_state: lastState, updated_at: new Date().toISOString() })
    .eq('id', s.boardId)
}

// Which slide ids need persisting after `slides` changed from `prev` to `next`.
// Ids present in prev but missing from next are included too — flushSave turns
// those into row DELETEs.
function diffDirty(prev: StudioSlide[], next: StudioSlide[]): string[] {
  const prevById = new Map(prev.map(sl => [sl.id, sl]))
  const nextIds = new Set(next.map(sl => sl.id))
  const dirty: string[] = []
  next.forEach(sl => {
    if (prevById.get(sl.id) !== sl) dirty.push(sl.id)
  })
  prev.forEach(sl => {
    if (!nextIds.has(sl.id)) dirty.push(sl.id)
  })
  return dirty
}

function mergeDirty(existing: string[], added: string[]): string[] {
  return Array.from(new Set([...existing, ...added]))
}

export function newId() {
  return crypto.randomUUID()
}

export const useStudioStore = create<StudioState>((set, get) => ({
  boardId: '',
  orgId: '',
  projectId: '',
  projectName: '',
  businessName: '',
  logoUrl: null,
  slides: [],
  currentSlideId: '',
  selectedIds: [],
  editingTextId: null,
  editingHeading: false,
  cropTargetId: null,
  viewport: { zoom: 1, x: 0, y: 0 },
  viewportRestored: false,
  clipboard: [],
  guides: { v: [], h: [] },
  presenting: false,
  exporting: false,
  past: [],
  future: [],
  dirtySlideIds: [],
  saveState: 'saved',

  init: props => {
    const restored = props.lastState
    const slideExists = restored?.slideId && props.slides.some(sl => sl.id === restored.slideId)
    set({
      boardId: props.boardId,
      orgId: props.orgId,
      projectId: props.projectId,
      projectName: props.projectName,
      businessName: props.businessName,
      logoUrl: props.logoUrl,
      slides: props.slides,
      currentSlideId: slideExists ? restored!.slideId! : (props.slides[0]?.id ?? ''),
      viewport: restored ? { zoom: restored.zoom, x: restored.panX, y: restored.panY } : { zoom: 1, x: 0, y: 0 },
      viewportRestored: !!restored,
      selectedIds: [],
      past: [],
      future: [],
      dirtySlideIds: [],
      saveState: 'saved',
      presenting: false,
      exporting: false,
    })
  },

  setCurrentSlide: id => {
    if (id === get().currentSlideId) return
    set({ currentSlideId: id, selectedIds: [], editingTextId: null, cropTargetId: null, editingHeading: false })
    scheduleStateSave()
  },
  setSelected: ids => set({ selectedIds: ids }),
  setEditingText: id => set({ editingTextId: id }),
  setEditingHeading: on => set({ editingHeading: on }),
  setCropTarget: id => set({ cropTargetId: id, selectedIds: id ? [id] : get().selectedIds }),
  setViewport: v => {
    set({ viewport: v })
    scheduleStateSave()
  },
  setGuides: g => set({ guides: g }),
  setPresenting: on => set({ presenting: on, selectedIds: [], editingTextId: null, cropTargetId: null }),

  commit: mutate => {
    const { slides, currentSlideId, past } = get()
    const next = mutate(slides)
    if (next === slides) return
    const snapshot: Snapshot = { slides, currentSlideId }
    set({
      slides: next,
      past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
      dirtySlideIds: mergeDirty(get().dirtySlideIds, diffDirty(slides, next)),
    })
    scheduleSave()
  },

  updateObject: (objId, patch) => get().updateObjects([{ id: objId, patch }]),

  updateObjects: patches => {
    const { currentSlideId } = get()
    const byId = new Map(patches.map(p => [p.id, p.patch]))
    get().commit(slides =>
      slides.map(sl =>
        sl.id !== currentSlideId
          ? sl
          : {
              ...sl,
              objects: sl.objects.map(o => (byId.has(o.id) ? ({ ...o, ...byId.get(o.id) } as StudioObject) : o)),
            }
      )
    )
  },

  addObjects: (objs, slideId) => {
    const target = slideId ?? get().currentSlideId
    get().commit(slides =>
      slides.map(sl => (sl.id !== target ? sl : { ...sl, objects: [...sl.objects, ...objs] }))
    )
    set({ selectedIds: objs.map(o => o.id) })
  },

  deleteSelected: () => {
    const { currentSlideId, selectedIds, slides } = get()
    const slide = slides.find(sl => sl.id === currentSlideId)
    if (!slide) return
    const ids = new Set(selectedIds.filter(id => !slide.objects.find(o => o.id === id)?.locked))
    if (ids.size === 0) return
    get().commit(sl =>
      sl.map(s => (s.id !== currentSlideId ? s : { ...s, objects: s.objects.filter(o => !ids.has(o.id)) }))
    )
    set({ selectedIds: [] })
  },

  duplicateSelected: () => {
    const { currentSlideId, selectedIds, slides } = get()
    const slide = slides.find(sl => sl.id === currentSlideId)
    if (!slide) return
    const copies = slide.objects
      .filter(o => selectedIds.includes(o.id))
      .map(o => ({ ...o, id: newId(), x: o.x + 12, y: o.y + 12, locked: false }))
    if (copies.length === 0) return
    get().addObjects(copies)
  },

  bringForward: objId => {
    const { currentSlideId } = get()
    get().commit(slides =>
      slides.map(sl => {
        if (sl.id !== currentSlideId) return sl
        const i = sl.objects.findIndex(o => o.id === objId)
        if (i < 0 || i === sl.objects.length - 1) return sl
        const objects = [...sl.objects]
        ;[objects[i], objects[i + 1]] = [objects[i + 1], objects[i]]
        return { ...sl, objects }
      })
    )
  },

  sendBack: objId => {
    const { currentSlideId } = get()
    get().commit(slides =>
      slides.map(sl => {
        if (sl.id !== currentSlideId) return sl
        const i = sl.objects.findIndex(o => o.id === objId)
        if (i <= 0) return sl
        const objects = [...sl.objects]
        ;[objects[i], objects[i - 1]] = [objects[i - 1], objects[i]]
        return { ...sl, objects }
      })
    )
  },

  copySelection: () => {
    const { currentSlideId, selectedIds, slides } = get()
    const slide = slides.find(sl => sl.id === currentSlideId)
    if (!slide) return
    const copied = slide.objects.filter(o => selectedIds.includes(o.id))
    if (copied.length) set({ clipboard: copied })
  },

  paste: () => {
    const { clipboard } = get()
    if (!clipboard.length) return
    const copies = clipboard.map(o => ({ ...o, id: newId(), x: o.x + 16, y: o.y + 16, locked: false }))
    get().addObjects(copies)
  },

  addSlide: name => {
    const id = newId()
    get().commit(slides => [
      ...slides,
      { id, name, heading: '', sortOrder: slides.length, objects: [] },
    ])
    set({ currentSlideId: id, selectedIds: [] })
  },

  renameSlide: (id, name) => {
    get().commit(slides => slides.map(sl => (sl.id === id ? { ...sl, name } : sl)))
  },

  setHeading: (id, heading) => {
    get().commit(slides => slides.map(sl => (sl.id === id ? { ...sl, heading } : sl)))
  },

  duplicateSlide: id => {
    const newSlideId = newId()
    get().commit(slides => {
      const i = slides.findIndex(sl => sl.id === id)
      if (i < 0) return slides
      const src = slides[i]
      const copy: StudioSlide = {
        ...src,
        id: newSlideId,
        name: `${src.name} copy`,
        objects: src.objects.map(o => ({ ...o, id: newId() })),
      }
      const next = [...slides.slice(0, i + 1), copy, ...slides.slice(i + 1)]
      return next.map((sl, idx) => (sl.sortOrder === idx ? sl : { ...sl, sortOrder: idx }))
    })
    set({ currentSlideId: newSlideId, selectedIds: [] })
  },

  deleteSlide: id => {
    const { slides, currentSlideId } = get()
    if (slides.length <= 1) return
    const i = slides.findIndex(sl => sl.id === id)
    get().commit(prev =>
      prev.filter(sl => sl.id !== id).map((sl, idx) => (sl.sortOrder === idx ? sl : { ...sl, sortOrder: idx }))
    )
    if (currentSlideId === id) {
      const next = get().slides
      set({ currentSlideId: next[Math.min(i, next.length - 1)]?.id ?? '', selectedIds: [] })
    }
  },

  reorderSlides: (from, to) => {
    if (from === to) return
    get().commit(slides => {
      const next = [...slides]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((sl, idx) => (sl.sortOrder === idx ? sl : { ...sl, sortOrder: idx }))
    })
  },

  undo: () => {
    const { past, future, slides, currentSlideId } = get()
    const snapshot = past[past.length - 1]
    if (!snapshot) return
    const restoredCurrent = snapshot.slides.some(sl => sl.id === snapshot.currentSlideId)
      ? snapshot.currentSlideId
      : (snapshot.slides[0]?.id ?? '')
    set({
      slides: snapshot.slides,
      currentSlideId: restoredCurrent,
      past: past.slice(0, -1),
      future: [...future, { slides, currentSlideId }],
      dirtySlideIds: mergeDirty(get().dirtySlideIds, diffDirty(slides, snapshot.slides)),
      selectedIds: [],
      editingTextId: null,
      cropTargetId: null,
    })
    scheduleSave()
  },

  redo: () => {
    const { past, future, slides, currentSlideId } = get()
    const snapshot = future[future.length - 1]
    if (!snapshot) return
    const restoredCurrent = snapshot.slides.some(sl => sl.id === snapshot.currentSlideId)
      ? snapshot.currentSlideId
      : (snapshot.slides[0]?.id ?? '')
    set({
      slides: snapshot.slides,
      currentSlideId: restoredCurrent,
      past: [...past, { slides, currentSlideId }],
      future: future.slice(0, -1),
      dirtySlideIds: mergeDirty(get().dirtySlideIds, diffDirty(slides, snapshot.slides)),
      selectedIds: [],
      editingTextId: null,
      cropTargetId: null,
    })
    scheduleSave()
  },

  flushSave: async () => {
    const s = get()
    if (!s.boardId || s.dirtySlideIds.length === 0) return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const dirty = s.dirtySlideIds
    set({ saveState: 'saving', dirtySlideIds: [] })
    const supabase = createClient()

    const currentIds = new Set(s.slides.map(sl => sl.id))
    const rows = s.slides
      .filter(sl => dirty.includes(sl.id))
      .map(sl => ({
        id: sl.id,
        board_id: s.boardId,
        org_id: s.orgId,
        name: sl.name,
        heading: sl.heading,
        sort_order: sl.sortOrder,
        objects: sl.objects,
        updated_at: new Date().toISOString(),
      }))
    const toDelete = dirty.filter(id => !currentIds.has(id))

    let failed = false
    if (rows.length) {
      const { error } = await supabase.from('studio_slides').upsert(rows)
      if (error) failed = true
    }
    if (!failed && toDelete.length) {
      const { error } = await supabase.from('studio_slides').delete().in('id', toDelete)
      if (error) failed = true
    }

    if (failed) {
      // Re-mark so the next change retries
      set({ saveState: 'error', dirtySlideIds: mergeDirty(get().dirtySlideIds, dirty) })
      return
    }
    // New edits may have arrived while saving — they re-marked dirtySlideIds themselves
    set({ saveState: get().dirtySlideIds.length ? 'saving' : 'saved' })
    if (get().dirtySlideIds.length) scheduleSave()
  },
}))

// Deleted slide ids must persist across the dirty list: diffDirty reports a removed
// slide as dirty (its id is in `dirty` but not in current slides), and flushSave
// turns that into a DELETE. An undo that restores the slide re-adds its id via
// diffDirty, and the upsert recreates the row.
