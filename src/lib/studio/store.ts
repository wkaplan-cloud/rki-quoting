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
  RfqRecipientStamp,
  StudioAssetRow,
  StudioSlideRow,
  StudioSpecRow,
} from './types'
import { DEFAULT_MASTER_LAYOUT, assetFromRow, slideFromRow, specFromRow } from './types'
import {
  MAX_HISTORY,
  SAVE_DEBOUNCE,
  STATE_SAVE_DEBOUNCE,
  MASTER_LAYOUT_SAVE_DEBOUNCE,
  LOCAL_PERSIST_DEBOUNCE,
  STUDIO_CLIPBOARD_PREFIX,
} from './constants'
import { putBoardSnapshot, getBoardSnapshot } from './offlineDb'

interface Snapshot {
  slides: StudioSlide[]
  currentSlideId: string
}

// What refreshFromServer() managed to pull. `slidesSkipped` means the asset
// library came down but the slides deliberately did not — see the action.
export interface RefreshResult {
  ok: boolean
  slidesSkipped: boolean
}

export interface Viewport {
  zoom: number
  x: number
  y: number
}

interface InitProps {
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

interface StudioState {
  boardId: string
  // The quoting project this board has been converted into, if any. null
  // until the first "Create quote"; drives Create vs Update/Open in the
  // Specs panel. Set once at load — a fresh convert navigates away, so it
  // only ever changes on the next page load.
  projectId: string | null
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  businessName: string
  logoUrl: string | null
  studioLogoUrl: string | null
  orgLogoUrl: string | null
  setStudioLogoUrl: (url: string | null) => void
  assets: StudioAsset[]
  masterLayout: MasterLayoutConfig
  suppliers: SpecSupplierOption[]
  activePriceListIds: string[]

  // Specs Engine: one spec per object, keyed by object id. Specs follow
  // their object through delete/undo/duplicate — see flushSave lifecycle.
  specs: Record<string, StudioSpec>
  specPanelObjectId: string | null
  // Object ids queued for the Request Quotes modal (null = modal closed)
  rfqObjectIds: string[] | null
  dirtySpecIds: string[]

  // Image files dropped while offline: parked in IndexedDB, drawn from a local
  // blob URL, uploaded for real on reconnect. See offlineUploads.ts.
  pendingUploads: number
  // Pending uploads the server refused outright — the object keeps its place on
  // the canvas so nothing vanishes, but it can never resolve to a real file.
  failedUploadIds: string[]
  setPendingUploads: (count: number) => void
  resolvePendingUpload: (uploadId: string, url: string) => void
  failPendingUpload: (uploadId: string) => void

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
  // The master layout lives on the board row rather than a slide, so it needs
  // its own dirty flag to ride the same offline retry loop.
  masterLayoutDirty: boolean
  saveState: 'saved' | 'saving' | 'error'

  init: (props: InitProps) => void
  // Re-applies work saved locally by an earlier session that never reached the
  // server. Async and idempotent — call once, right after init.
  hydrateFromLocal: () => Promise<void>
  refreshFromServer: () => Promise<RefreshResult>
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
  renameAsset: (id: string, label: string | null) => void
  removeAsset: (id: string) => void
  openSpecs: (objectId: string | null) => void
  openRfq: (objectIds: string[] | null) => void
  markSpecsRfqSent: (stamps: { objectId: string; at: string; recipients: RfqRecipientStamp[] }[]) => void
  updateSpec: (objectId: string, patch: Partial<StudioSpec>) => void

  commit: (mutate: (slides: StudioSlide[]) => StudioSlide[]) => void
  // Object helpers (all operate on the current slide unless a slideId is given)
  updateObject: (objId: string, patch: Partial<StudioObject>) => void
  updateObjects: (patches: { id: string; patch: Partial<StudioObject> }[]) => void
  addObjects: (objs: StudioObject[], slideId?: string) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  bringToFront: (objId: string) => void
  sendToBack: (objId: string) => void
  copySelection: () => void
  paste: () => void
  pasteObjects: (objs: StudioObject[]) => void
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
let localTimer: ReturnType<typeof setTimeout> | null = null
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
  // Mirror locally on the same edits that schedule a server save. This runs on
  // its own (shorter) debounce so an edit is durable on the device well before
  // the network round-trip is even attempted.
  schedulePersistLocal()
}

function schedulePersistLocal() {
  if (localTimer) clearTimeout(localTimer)
  localTimer = setTimeout(() => {
    localTimer = null
    void persistLocal()
  }, LOCAL_PERSIST_DEBOUNCE)
}

// Write the current board state to IndexedDB. Best-effort by design: a device
// with no storage quota simply falls back to the in-memory-only behaviour.
export async function persistLocal(): Promise<void> {
  const s = useStudioStore.getState()
  if (!s.boardId) return
  if (localTimer) {
    clearTimeout(localTimer)
    localTimer = null
  }
  try {
    await putBoardSnapshot({
      boardId: s.boardId,
      orgId: s.orgId,
      slides: s.slides,
      specs: s.specs,
      dirtySlideIds: s.dirtySlideIds,
      dirtySpecIds: s.dirtySpecIds,
      masterLayout: s.masterLayout,
      masterLayoutDirty: s.masterLayoutDirty,
    })
  } catch {
    // Storage is a safety net, never a dependency
  }
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
  schedulePersistLocal()
}

// Returns false when the write did not land, so the caller can keep the dirty
// flag set and let the retry loop pick it up. Theme changes used to be
// fire-and-forget, which quietly dropped them when made offline.
async function saveMasterLayout(): Promise<boolean> {
  const s = useStudioStore.getState()
  if (!s.boardId) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    scheduleRetry()
    return false
  }
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('studio_boards')
      .update({ master_layout: s.masterLayout, updated_at: new Date().toISOString() })
      .eq('id', s.boardId)
    if (error) {
      scheduleRetry()
      return false
    }
    useStudioStore.setState({ masterLayoutDirty: false })
    void persistLocal()
    return true
  } catch {
    scheduleRetry()
    return false
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

// ── Layer order ─────────────────────────────────────────────────────────────
// There is no fixed set of layers: an object's stacking position IS its index
// in slide.objects, 0 being the back. `target` returns the index to move to.
// Returning the slides array UNCHANGED when nothing would move matters —
// commit() bails on an identical reference, so tapping "bring to front" on
// something already at the front records no empty undo step.
function reorderObject(
  slides: StudioSlide[],
  slideId: string,
  objId: string,
  target: (from: number, count: number) => number
): StudioSlide[] {
  const slide = slides.find(sl => sl.id === slideId)
  if (!slide) return slides
  const from = slide.objects.findIndex(o => o.id === objId)
  if (from < 0) return slides
  const to = target(from, slide.objects.length)
  if (to === from || to < 0 || to >= slide.objects.length) return slides
  const objects = [...slide.objects]
  const [moved] = objects.splice(from, 1)
  objects.splice(to, 0, moved)
  return slides.map(sl => (sl.id === slideId ? { ...sl, objects } : sl))
}

export const useStudioStore = create<StudioState>((set, get) => ({
  boardId: '',
  projectId: null,
  orgId: '',
  clientId: '',
  clientName: '',
  boardName: '',
  businessName: '',
  logoUrl: null,
  studioLogoUrl: null,
  orgLogoUrl: null,
  setStudioLogoUrl: url => set(s => ({ studioLogoUrl: url, logoUrl: url ?? s.orgLogoUrl })),
  assets: [],
  masterLayout: DEFAULT_MASTER_LAYOUT,
  suppliers: [],
  activePriceListIds: [],
  specs: {},
  specPanelObjectId: null,
  rfqObjectIds: null,
  dirtySpecIds: [],
  pendingUploads: 0,
  failedUploadIds: [],
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
  masterLayoutDirty: false,
  saveState: 'saved',

  init: props => {
    const restored = props.lastState
    const slideExists = restored?.slideId && props.slides.some(sl => sl.id === restored.slideId)
    set({
      boardId: props.boardId,
      projectId: props.projectId,
      orgId: props.orgId,
      clientId: props.clientId,
      clientName: props.clientName,
      boardName: props.boardName,
      businessName: props.businessName,
      logoUrl: props.logoUrl,
      studioLogoUrl: props.studioLogoUrl,
      orgLogoUrl: props.orgLogoUrl,
      assets: props.assets,
      masterLayout: props.masterLayout,
      suppliers: props.suppliers,
      activePriceListIds: props.activePriceListIds,
      specs: Object.fromEntries(props.specs.map(sp => [sp.objectId, sp])),
      specPanelObjectId: null,
      rfqObjectIds: null,
      dirtySpecIds: (() => {
        savedSpecObjectIds.clear()
        props.specs.forEach(sp => savedSpecObjectIds.add(sp.objectId))
        return []
      })(),
      slides: props.slides,
      pendingUploads: 0,
      failedUploadIds: [],
      currentSlideId: slideExists ? restored!.slideId! : (props.slides[0]?.id ?? ''),
      viewport: restored ? { zoom: restored.zoom, x: restored.panX, y: restored.panY } : { zoom: 1, x: 0, y: 0 },
      viewportRestored: !!restored,
      selectedIds: [],
      past: [],
      future: [],
      dirtySlideIds: [],
      masterLayoutDirty: false,
      saveState: 'saved',
      presenting: false,
      exporting: false,
      bgRemoval: {},
    })
  },

  // ── Offline recovery ──────────────────────────────────────────────────────
  // init() has just loaded the server's copy of the board. If an earlier
  // session on this device ended with unsynced work — signal dropped, the tab
  // was evicted, the iPad went to sleep — that work is sitting in IndexedDB and
  // has to be put back before the designer touches anything.
  //
  // The merge is per slide, not whole-board: only slides that were actually
  // left dirty come from the local copy, everything else stays on the server's
  // version. That way a colleague's edits to other slides survive, instead of
  // being flattened by a stale snapshot.
  // Manual "Refresh" from the editor header. Two things go stale on a long
  // iPad session: the asset library (a colleague imported images from another
  // device) and the slides themselves. Pulling them again is what the button
  // is for — a browser reload is not a substitute, since the service worker
  // can answer a flaky-signal navigation from cache.
  //
  // Safety rule: this must never destroy work. The asset library carries no
  // local-only state so it always refreshes, but slides and specs come back
  // down ONLY when this device is fully in sync — otherwise the server copy
  // would silently overwrite edits that have not been flushed yet.
  refreshFromServer: async () => {
    const s = get()
    if (!s.boardId) return { ok: false, slidesSkipped: true }
    const supabase = createClient()

    const assetRes = await supabase
      .from('studio_assets')
      .select('id, board_id, org_id, url, hash, natural_width, natural_height, file_size, created_at, label')
      .eq('board_id', s.boardId)
      .order('created_at', { ascending: false })
    if (assetRes.error) return { ok: false, slidesSkipped: true }
    if (get().boardId !== s.boardId) return { ok: true, slidesSkipped: true }
    set({ assets: ((assetRes.data ?? []) as StudioAssetRow[]).map(assetFromRow) })

    const dirty = (st: StudioState) =>
      st.dirtySlideIds.length > 0 || st.dirtySpecIds.length > 0 || st.masterLayoutDirty || st.saveState !== 'saved'
    if (dirty(get())) return { ok: true, slidesSkipped: true }

    const [slideRes, specRes] = await Promise.all([
      supabase
        .from('studio_slides')
        .select('id, board_id, org_id, name, heading, sort_order, objects, is_cover')
        .eq('board_id', s.boardId)
        .order('sort_order'),
      supabase
        .from('studio_specs')
        .select(
          'id, board_id, org_id, slide_id, object_id, spec_name, description, notes, supplier_id, supplier_name, category, quantity, unit, width, depth, height, materials, status, piece_id, item_specs'
        )
        .eq('board_id', s.boardId),
    ])
    if (slideRes.error || specRes.error) return { ok: false, slidesSkipped: true }

    // An edit may have landed while those queries were in flight, and the
    // board may even have been swapped underneath us — re-check before
    // replacing anything.
    const live = get()
    if (live.boardId !== s.boardId || dirty(live)) return { ok: true, slidesSkipped: true }

    const slides = ((slideRes.data ?? []) as StudioSlideRow[]).map(slideFromRow)
    // A board that reads back empty is far more likely to be a permission or
    // filter problem than a genuinely blank board — never wipe the canvas on it
    if (!slides.length) return { ok: true, slidesSkipped: true }

    const specs = ((specRes.data ?? []) as StudioSpecRow[]).map(specFromRow)
    savedSpecObjectIds.clear()
    specs.forEach(sp => savedSpecObjectIds.add(sp.objectId))

    set({
      slides,
      specs: Object.fromEntries(specs.map(sp => [sp.objectId, sp])),
      // The slide being edited may have been deleted on the other device
      currentSlideId: slides.some(sl => sl.id === live.currentSlideId) ? live.currentSlideId : slides[0].id,
      selectedIds: [],
      editingTextId: null,
      editingHeading: false,
      cropTargetId: null,
      // Every entry in the undo stack describes slides this client no longer
      // holds, so replaying one would resurrect the pre-refresh board
      past: [],
      future: [],
    })
    return { ok: true, slidesSkipped: false }
  },

  hydrateFromLocal: async () => {
    const s = get()
    if (!s.boardId) return
    const snap = await getBoardSnapshot(s.boardId)
    if (!snap || snap.boardId !== s.boardId) return

    const dirtySlides = new Set(snap.dirtySlideIds ?? [])
    const dirtySpecs = snap.dirtySpecIds ?? []
    if (!dirtySlides.size && !dirtySpecs.length && !snap.masterLayoutDirty) return

    // The board may have moved on since init() ran (a fast typist, or a second
    // hydrate) — re-read rather than trusting the captured snapshot of state.
    const live = get()
    if (live.boardId !== s.boardId) return
    if (live.dirtySlideIds.length || live.dirtySpecIds.length) return

    const localSlides = new Map((snap.slides ?? []).map(sl => [sl.id, sl]))
    const serverIds = new Set(live.slides.map(sl => sl.id))

    const merged: StudioSlide[] = []
    for (const sl of live.slides) {
      if (!dirtySlides.has(sl.id)) {
        merged.push(sl)
        continue
      }
      const local = localSlides.get(sl.id)
      // Dirty but absent locally = deleted offline; leave it out so the flush
      // turns it into the DELETE it was always meant to be.
      if (local) merged.push(local)
    }
    // Slides created offline have no server row yet
    for (const id of dirtySlides) {
      if (!serverIds.has(id)) {
        const local = localSlides.get(id)
        if (local) merged.push(local)
      }
    }
    merged.sort((a, b) => a.sortOrder - b.sortOrder)

    const specs = { ...live.specs }
    for (const objectId of dirtySpecs) {
      const local = snap.specs?.[objectId]
      if (local) specs[objectId] = local
    }

    const currentStillExists = merged.some(sl => sl.id === live.currentSlideId)

    set({
      slides: merged,
      specs,
      masterLayout: snap.masterLayoutDirty ? snap.masterLayout : live.masterLayout,
      masterLayoutDirty: !!snap.masterLayoutDirty,
      dirtySlideIds: snap.dirtySlideIds ?? [],
      dirtySpecIds: dirtySpecs,
      currentSlideId: currentStillExists ? live.currentSlideId : (merged[0]?.id ?? ''),
      // Recovered work is not an undo step — there is nothing sensible to undo
      // back to, and the pre-recovery state was never the designer's intent.
      past: [],
      future: [],
      selectedIds: [],
      saveState: 'saving',
    })
    void useStudioStore.getState().flushSave()
  },

  setPendingUploads: count => set({ pendingUploads: count }),

  // A queued image finally reached storage: swap the sentinel for the real URL
  // everywhere it appears, including the history stacks so an undo doesn't walk
  // back to a blob that no longer exists.
  resolvePendingUpload: (uploadId, url) => {
    const token = `pending://${uploadId}`
    const patchObject = (o: StudioObject): StudioObject => {
      if (o.type !== 'image') return o
      const hit = o.url === token || o.originalUrl === token || o.processedUrl === token
      if (!hit) return o
      return {
        ...o,
        url: o.url === token ? url : o.url,
        originalUrl: o.originalUrl === token ? url : o.originalUrl,
        processedUrl: o.processedUrl === token ? url : o.processedUrl,
      }
    }
    const patchSlides = (slides: StudioSlide[]) => {
      let changed = false
      const next = slides.map(sl => {
        let slideChanged = false
        const objects = sl.objects.map(o => {
          const patched = patchObject(o)
          if (patched !== o) slideChanged = true
          return patched
        })
        if (!slideChanged) return sl
        changed = true
        return { ...sl, objects }
      })
      return changed ? next : slides
    }

    const { slides, past, future, dirtySlideIds } = get()
    const nextSlides = patchSlides(slides)
    if (nextSlides === slides) return
    const touched = nextSlides.filter((sl, i) => sl !== slides[i]).map(sl => sl.id)
    set({
      slides: nextSlides,
      past: past.map(sn => ({ ...sn, slides: patchSlides(sn.slides) })),
      future: future.map(sn => ({ ...sn, slides: patchSlides(sn.slides) })),
      dirtySlideIds: mergeDirty(dirtySlideIds, touched),
      failedUploadIds: get().failedUploadIds.filter(id => id !== uploadId),
    })
    scheduleSave()
  },

  failPendingUpload: uploadId =>
    set(s => ({ failedUploadIds: Array.from(new Set([...s.failedUploadIds, uploadId])) })),

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
    set(s => ({ masterLayout: { ...s.masterLayout, ...patch }, masterLayoutDirty: true }))
    scheduleMasterLayoutSave()
  },
  setPresenting: on => set({ presenting: on, selectedIds: [], editingTextId: null, cropTargetId: null }),

  addAsset: asset => {
    const { assets } = get()
    if (assets.some(a => a.id === asset.id || a.hash === asset.hash)) return
    set({ assets: [asset, ...assets] })
  },

  renameAsset: (id, label) => {
    set({ assets: get().assets.map(a => (a.id === id ? { ...a, label } : a)) })
  },

  removeAsset: id => {
    set({ assets: get().assets.filter(a => a.id !== id) })
  },

  openSpecs: objectId => set({ specPanelObjectId: objectId }),

  openRfq: objectIds => set({ rfqObjectIds: objectIds }),

  // Memory-only: the RFQ route already stamped the DB rows, so this must NOT
  // mark the specs dirty (a client flush would not include the rfq columns,
  // but there's no reason to rewrite untouched rows either)
  markSpecsRfqSent: stamps => {
    const { specs } = get()
    const next = { ...specs }
    for (const s of stamps) {
      const spec = next[s.objectId]
      if (!spec) continue
      next[s.objectId] = {
        ...spec,
        rfqSentAt: s.at,
        rfqSentTo: [...spec.rfqSentTo, ...s.recipients],
      }
    }
    set({ specs: next })
  },

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
          rfqSentAt: null,
          rfqSentTo: [],
          pieceId: null,
          itemSpecs: {},
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

  bringToFront: objId => {
    const { currentSlideId } = get()
    get().commit(slides => reorderObject(slides, currentSlideId, objId, (_from, count) => count - 1))
  },

  sendToBack: objId => {
    const { currentSlideId } = get()
    get().commit(slides => reorderObject(slides, currentSlideId, objId, () => 0))
  },

  copySelection: () => {
    const { currentSlideId, selectedIds, slides } = get()
    const slide = slides.find(sl => sl.id === currentSlideId)
    if (!slide) return
    const copied = slide.objects.filter(o => selectedIds.includes(o.id))
    if (!copied.length) return
    set({ clipboard: copied })
    // Mirror to the OS clipboard so the copy can be pasted into another
    // board/tab (CanvasArea's paste handler recognises the prefix). The
    // copied images' asset-library entries ride along so the target board's
    // Asset panel picks them up too. Best effort — the in-memory clipboard
    // above keeps same-board paste working even if this write is blocked.
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const urls = new Set<string>()
      for (const o of copied) {
        if (o.type !== 'image') continue
        urls.add(o.url)
        if (o.originalUrl) urls.add(o.originalUrl)
      }
      const assets = get().assets.filter(a => urls.has(a.url))
      void navigator.clipboard
        .writeText(STUDIO_CLIPBOARD_PREFIX + JSON.stringify({ objects: copied, assets }))
        .catch(() => {})
    }
  },

  paste: () => {
    const { clipboard } = get()
    if (clipboard.length) get().pasteObjects(clipboard)
  },

  pasteObjects: objs => {
    if (!objs.length) return
    const idMap: [string, string][] = []
    const copies = objs.map(o => {
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
    if (
      !s.boardId ||
      (s.dirtySlideIds.length === 0 && s.dirtySpecIds.length === 0 && !s.masterLayoutDirty)
    )
      return
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
      // The network is gone, so this is exactly when the local mirror matters
      void persistLocal()
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
          piece_id: sp.pieceId,
          item_specs: sp.itemSpecs,
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
      // A theme change made offline rides the same flush
      if (!failed && get().masterLayoutDirty) {
        if (!(await saveMasterLayout())) failed = true
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
      void persistLocal()
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
    // Keep the mirror in step with what the server now holds, so a cold offline
    // open reads the synced state rather than replaying work already saved
    void persistLocal()
  },
}))

// Deleted slide ids must persist across the dirty list: diffDirty reports a removed
// slide as dirty (its id is in `dirty` but not in current slides), and flushSave
// turns that into a DELETE. An undo that restores the slide re-adds its id via
// diffDirty, and the upsert recreates the row.
