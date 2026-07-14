'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type {
  StudioObject,
  StudioSlide,
  BoardLastState,
  StudioAsset,
  MasterLayoutConfig,
  StudioSpec,
  SpecSupplierOption,
} from './types'
import { DEFAULT_MASTER_LAYOUT } from './types'
import { MAX_HISTORY, SAVE_DEBOUNCE, STATE_SAVE_DEBOUNCE, MASTER_LAYOUT_SAVE_DEBOUNCE } from './constants'

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
  clientId: string
  clientName: string
  boardName: string
  businessName: string
  logoUrl: string | null
  slides: StudioSlide[]
  assets: StudioAsset[]
  specs: StudioSpec[]
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]
  masterLayout: MasterLayoutConfig
  lastState: BoardLastState | null
}

interface StudioState {
  boardId: string
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  businessName: string
  logoUrl: string | null
  assets: StudioAsset[]
  masterLayout: MasterLayoutConfig
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]

  // Specs Engine: one spec per object, keyed by object id. Specs follow
  // their object through delete/undo/duplicate — see flushSave lifecycle.
  specs: Record<string, StudioSpec>
  specPanelObjectId: string | null
  dirtySpecIds: string[]

  // Background removal: transient per-object status. Never persisted and
  // never part of undo snapshots — the durable result lives on the object
  // itself (originalUrl/processedUrl/url).
  bgRemoval: Record<string, 'processing' | 'error'>
  setBgRemoval: (objId: string, state: 'processing' | 'error' | null) => void

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
  setMasterLayout: (patch: Partial<MasterLayoutConfig>) => void
  setPresenting: (on: boolean) => void
  addAsset: (asset: StudioAsset) => void
  openSpecs: (objectId: string | null) => void
  updateSpec: (objectId: string, patch: Partial<StudioSpec>) => void

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
let retryTimer: ReturnType<typeof setTimeout> | null = null
let masterLayoutTimer: ReturnType<typeof setTimeout> | null = null
// Version-history foundation: one revision snapshot per slide, at most every
// REVISION_INTERVAL of active editing. No UI yet — restore comes later.
const REVISION_INTERVAL = 5 * 60 * 1000
const lastRevisionAt = new Map<string, number>()

// Which spec object_ids currently have a row in the DB. Drives the spec
// lifecycle: deleting an object deletes its row (client copy is kept so undo
// can restore it — the next flush simply re-upserts).
const savedSpecObjectIds = new Set<string>()

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void useStudioStore.getState().flushSave()
  }, SAVE_DEBOUNCE)
}

function scheduleRetry() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void useStudioStore.getState().flushSave()
  }, 4000)
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
  try {
    const supabase = createClient()
    await supabase
      .from('studio_boards')
      .update({ last_state: lastState, updated_at: new Date().toISOString() })
      .eq('id', s.boardId)
  } catch {
    // Cosmetic state (zoom/pan/slide) — never worth surfacing offline noise
  }
}

function scheduleMasterLayoutSave() {
  if (masterLayoutTimer) clearTimeout(masterLayoutTimer)
  masterLayoutTimer = setTimeout(() => {
    masterLayoutTimer = null
    void saveMasterLayout()
  }, MASTER_LAYOUT_SAVE_DEBOUNCE)
}

async function saveMasterLayout() {
  const s = useStudioStore.getState()
  if (!s.boardId) return
  try {
    const supabase = createClient()
    await supabase
      .from('studio_boards')
      .update({ master_layout: s.masterLayout, updated_at: new Date().toISOString() })
      .eq('id', s.boardId)
  } catch {
    // Best-effort, same tier as saveLastState — the in-memory value driving
    // the live preview is already correct regardless of save success
  }
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

// Duplicating an object duplicates its spec (new spec id, new object id)
function copySpecsForDuplicates(idMap: [oldId: string, newId: string][]) {
  const { specs } = useStudioStore.getState()
  const additions: Record<string, StudioSpec> = {}
  const dirty: string[] = []
  for (const [oldId, dupId] of idMap) {
    const src = specs[oldId]
    if (!src) continue
    additions[dupId] = {
      ...src,
      id: newId(),
      objectId: dupId,
      materials: src.materials.map(m => ({ ...m, id: newId() })),
    }
    dirty.push(dupId)
  }
  if (!dirty.length) return
  useStudioStore.setState(s => ({
    specs: { ...s.specs, ...additions },
    dirtySpecIds: Array.from(new Set([...s.dirtySpecIds, ...dirty])),
  }))
  scheduleSave()
}

export const useStudioStore = create<StudioState>((set, get) => ({
  boardId: '',
  orgId: '',
  clientId: '',
  clientName: '',
  boardName: '',
  businessName: '',
  logoUrl: null,
  assets: [],
  masterLayout: DEFAULT_MASTER_LAYOUT,
  suppliers: [],
  activePriceListIds: [],
  specs: {},
  specPanelObjectId: null,
  dirtySpecIds: [],
  bgRemoval: {},
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
      clientId: props.clientId,
      clientName: props.clientName,
      boardName: props.boardName,
      businessName: props.businessName,
      logoUrl: props.logoUrl,
      assets: props.assets,
      masterLayout: props.masterLayout,
      suppliers: props.suppliers,
      activePriceListIds: props.activePriceListIds,
      specs: Object.fromEntries(props.specs.map(sp => [sp.objectId, sp])),
      specPanelObjectId: null,
      dirtySpecIds: (() => {
        savedSpecObjectIds.clear()
        props.specs.forEach(sp => savedSpecObjectIds.add(sp.objectId))
        return []
      })(),
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
      bgRemoval: {},
    })
  },

  setBgRemoval: (objId, state) =>
    set(s => {
      const next = { ...s.bgRemoval }
      if (state) next[objId] = state
      else delete next[objId]
      return { bgRemoval: next }
    }),

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
  setMasterLayout: patch => {
    set(s => ({ masterLayout: { ...s.masterLayout, ...patch } }))
    scheduleMasterLayoutSave()
  },
  setPresenting: on => set({ presenting: on, selectedIds: [], editingTextId: null, cropTargetId: null }),

  addAsset: asset => {
    const { assets } = get()
    if (assets.some(a => a.id === asset.id || a.hash === asset.hash)) return
    set({ assets: [asset, ...assets] })
  },

  openSpecs: objectId => set({ specPanelObjectId: objectId }),

  updateSpec: (objectId, patch) => {
    const { specs, slides, currentSlideId } = get()
    const existing = specs[objectId]
    const slideId =
      slides.find(sl => sl.objects.some(o => o.id === objectId))?.id ??
      existing?.slideId ??
      currentSlideId
    const next: StudioSpec = existing
      ? { ...existing, ...patch, slideId }
      : {
          id: newId(),
          objectId,
          slideId,
          specName: '',
          description: '',
          notes: '',
          supplierId: null,
          supplierName: '',
          category: '',
          quantity: '',
          unit: '',
          width: '',
          depth: '',
          height: '',
          materials: [],
          status: 'draft',
          ...patch,
        }
    set({
      specs: { ...specs, [objectId]: next },
      dirtySpecIds: Array.from(new Set([...get().dirtySpecIds, objectId])),
    })
    scheduleSave()
  },

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
    const idMap: [string, string][] = []
    const copies = slide.objects
      .filter(o => selectedIds.includes(o.id))
      .map(o => {
        const dupId = newId()
        idMap.push([o.id, dupId])
        return { ...o, id: dupId, x: o.x + 12, y: o.y + 12, locked: false }
      })
    if (copies.length === 0) return
    get().addObjects(copies)
    copySpecsForDuplicates(idMap)
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
    const idMap: [string, string][] = []
    const copies = clipboard.map(o => {
      const dupId = newId()
      idMap.push([o.id, dupId])
      return { ...o, id: dupId, x: o.x + 16, y: o.y + 16, locked: false }
    })
    get().addObjects(copies)
    copySpecsForDuplicates(idMap)
  },

  addSlide: name => {
    const id = newId()
    get().commit(slides => [
      // The "new slide" input is the only name a user gives this slide —
      // it becomes the visible heading too, so the sidebar label isn't the
      // only place it appears
      ...slides,
      { id, name, heading: name, sortOrder: slides.length, objects: [], isCover: false },
    ])
    set({ currentSlideId: id, selectedIds: [] })
  },

  renameSlide: (id, name) => {
    get().commit(slides => slides.map(sl => (sl.id === id ? { ...sl, name } : sl)))
  },

  setHeading: (id, heading) => {
    // Keep the sidebar label in step with the heading the user actually
    // edits on the canvas — otherwise it stays "Slide 2" forever. Only
    // syncs on a non-empty heading so clearing it doesn't blank the label.
    get().commit(slides =>
      slides.map(sl =>
        sl.id === id ? { ...sl, heading, name: heading.trim() ? heading : sl.name } : sl
      )
    )
  },

  duplicateSlide: id => {
    const newSlideId = newId()
    const idMap: [string, string][] = []
    get().commit(slides => {
      const i = slides.findIndex(sl => sl.id === id)
      if (i < 0) return slides
      const src = slides[i]
      const copy: StudioSlide = {
        ...src,
        id: newSlideId,
        name: `${src.name} copy`,
        objects: src.objects.map(o => {
          const dupId = newId()
          idMap.push([o.id, dupId])
          return { ...o, id: dupId }
        }),
      }
      const next = [...slides.slice(0, i + 1), copy, ...slides.slice(i + 1)]
      return next.map((sl, idx) => (sl.sortOrder === idx ? sl : { ...sl, sortOrder: idx }))
    })
    set({ currentSlideId: newSlideId, selectedIds: [] })
    copySpecsForDuplicates(idMap)
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
    if (!s.boardId || (s.dirtySlideIds.length === 0 && s.dirtySpecIds.length === 0)) return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    // Definitely offline — skip the doomed network round-trip, keep every
    // change marked dirty and let the retry loop / reconnect listener flush.
    // Editing continues normally in memory the whole time.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ saveState: 'error' })
      scheduleRetry()
      return
    }
    const dirty = s.dirtySlideIds
    const dirtySpecs = s.dirtySpecIds
    set({ saveState: 'saving', dirtySlideIds: [], dirtySpecIds: [] })
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
        is_cover: sl.isCover,
        updated_at: new Date().toISOString(),
      }))
    const toDelete = dirty.filter(id => !currentIds.has(id))

    // Everything network-touching sits inside try/catch: supabase-js can
    // reject outright on a dropped connection, and an uncaught throw here
    // would strand saveState on 'saving' with the dirty lists already
    // cleared — silently losing the offline edits.
    let failed = false
    try {
    if (rows.length) {
      const { error } = await supabase.from('studio_slides').upsert(rows)
      if (error) failed = true
    }
    if (!failed && toDelete.length) {
      const { error } = await supabase.from('studio_slides').delete().in('id', toDelete)
      if (error) failed = true
    }

    // ── Specs lifecycle ──────────────────────────────────────────────────
    // Save specs whose object exists and which are dirty OR missing from the
    // DB (an undo just restored their object); delete rows whose object is
    // gone, keeping the client copy so a later undo can bring them back.
    const fresh = get()
    const liveObjectIds = new Set(fresh.slides.flatMap(sl => sl.objects.map(o => o.id)))
    if (!failed) {
      const specsToSave = Object.values(fresh.specs).filter(
        sp =>
          liveObjectIds.has(sp.objectId) &&
          (dirtySpecs.includes(sp.objectId) || !savedSpecObjectIds.has(sp.objectId))
      )
      if (specsToSave.length) {
        const specRows = specsToSave.map(sp => ({
          id: sp.id,
          board_id: fresh.boardId,
          org_id: fresh.orgId,
          slide_id:
            fresh.slides.find(sl => sl.objects.some(o => o.id === sp.objectId))?.id ?? sp.slideId,
          object_id: sp.objectId,
          spec_name: sp.specName,
          description: sp.description,
          notes: sp.notes,
          supplier_id: sp.supplierId,
          supplier_name: sp.supplierName,
          category: sp.category,
          quantity: sp.quantity,
          unit: sp.unit,
          width: sp.width,
          depth: sp.depth,
          height: sp.height,
          materials: sp.materials,
          status: sp.status,
          updated_at: new Date().toISOString(),
        }))
        const { error } = await supabase
          .from('studio_specs')
          .upsert(specRows, { onConflict: 'object_id' })
        if (error) failed = true
        else specsToSave.forEach(sp => savedSpecObjectIds.add(sp.objectId))
      }
      if (!failed) {
        const orphaned = Array.from(savedSpecObjectIds).filter(oid => !liveObjectIds.has(oid))
        if (orphaned.length) {
          const { error } = await supabase
            .from('studio_specs')
            .delete()
            .eq('board_id', fresh.boardId)
            .in('object_id', orphaned)
          if (error) failed = true
          else orphaned.forEach(oid => savedSpecObjectIds.delete(oid))
        }
      }
    }
    } catch {
      failed = true
    }

    if (failed) {
      // Re-mark and retry automatically — a dropped connection must not
      // silently lose work
      set({
        saveState: 'error',
        dirtySlideIds: mergeDirty(get().dirtySlideIds, dirty),
        dirtySpecIds: Array.from(new Set([...get().dirtySpecIds, ...dirtySpecs])),
      })
      scheduleRetry()
      return
    }

    // Version-history snapshots (fire-and-forget, throttled per slide)
    const now = Date.now()
    const revisionRows = rows
      .filter(r => now - (lastRevisionAt.get(r.id) ?? 0) > REVISION_INTERVAL)
      .map(r => ({
        board_id: r.board_id,
        org_id: r.org_id,
        slide_id: r.id,
        name: r.name,
        heading: r.heading,
        objects: r.objects,
      }))
    if (revisionRows.length) {
      revisionRows.forEach(r => lastRevisionAt.set(r.slide_id, now))
      void supabase
        .from('studio_slide_revisions')
        .insert(revisionRows)
        .then(() => {}, () => {}) // best-effort: history must never block or fail a save
    }

    // New edits may have arrived while saving — they re-marked dirty ids themselves
    const stillDirty = get().dirtySlideIds.length > 0 || get().dirtySpecIds.length > 0
    set({ saveState: stillDirty ? 'saving' : 'saved' })
    if (stillDirty) scheduleSave()
  },
}))

// Deleted slide ids must persist across the dirty list: diffDirty reports a removed
// slide as dirty (its id is in `dirty` but not in current slides), and flushSave
// turns that into a DELETE. An undo that restores the slide re-adds its id via
// diffDirty, and the upsert recreates the row.
