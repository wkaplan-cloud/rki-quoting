// A3 landscape in PostScript points — matches jsPDF's A3 page (1190.55 × 841.89pt)
// so the exported PDF maps 1:1 onto the canvas coordinate space.
export const PAGE_W = 1191
export const PAGE_H = 842

// Master layout bands (kept clear by the multi-image auto-layout)
export const MASTER_TOP = 70 // project name + slide heading
export const MASTER_BOTTOM = 54 // page number + company logo
export const MASTER_SIDE = 40

export const FONT_FAMILIES = ['Helvetica', 'Arial', 'Georgia', 'Times New Roman', 'Courier New']
export const DEFAULT_FONT = 'Helvetica'

// Canvas zoom limits and the presets offered in the zoom menu / stepped by ±
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]

// Breathing room left around the page when fitting it to the viewport
export const FIT_PADDING_X = 96
export const FIT_PADDING_Y = 120

// Snap threshold in screen pixels (divided by zoom at use site for constant feel)
export const SNAP_THRESHOLD = 6

// Undo history cap
export const MAX_HISTORY = 50

// Autosave debounce (ms)
export const SAVE_DEBOUNCE = 800
export const STATE_SAVE_DEBOUNCE = 2000
export const MASTER_LAYOUT_SAVE_DEBOUNCE = 600
// Local (IndexedDB) mirror runs ahead of the network save — an edit should be
// durable on the device long before the round-trip is attempted
export const LOCAL_PERSIST_DEBOUNCE = 400

// Editor chrome palette (matches app conventions)
export const COLORS = {
  ink: '#1A1A18',
  text: '#2C2C2A',
  muted: '#8A877F',
  surface: '#F5F2EC',
  surfaceAlt: '#EDE9E1',
  border: '#D8D3C8',
  accent: '#9A7B4F',
  accentBright: '#C4A46B',
}

// Object default styling
export const OBJECT_DEFAULTS = {
  shapeFill: '#EDE9E1',
  shapeStroke: '#2C2C2A',
  strokeWidth: 2,
  textFill: '#2C2C2A',
  fontSize: 24,
}

export const SWATCHES = [
  '#2C2C2A', '#8A877F', '#FFFFFF', '#EDE9E1', '#9A7B4F', '#C4A46B',
  '#7A8B7F', '#5B7086', '#8A5B5B', '#B08968', '#4A4E58', '#D9C7B2',
]

// ⌘C mirrors selected objects onto the OS clipboard as prefixed JSON so ⌘V
// works across boards/tabs, not just within one editor's in-memory clipboard
export const STUDIO_CLIPBOARD_PREFIX = 'quotinghub-studio-objects:'

export const STORAGE_BUCKET = 'studio-images'
export const THUMB_W = 184
