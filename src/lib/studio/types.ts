// Studio module object model.
// All coordinates are in page points — a fixed A3 landscape space of PAGE_W × PAGE_H
// (see constants.ts). Z-order is the index in StudioSlide.objects (first = back).

export interface StudioObjectBase {
  id: string
  x: number
  y: number
  rotation: number // degrees, around the object's top-left origin
  opacity: number // 0–1
  locked: boolean
}

export interface ImageObject extends StudioObjectBase {
  type: 'image'
  url: string
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  // Crop rect in SOURCE pixels — maps 1:1 to Konva.Image's `crop` prop
  crop?: { x: number; y: number; width: number; height: number }
  borderColor?: string
  borderWidth?: number
}

export interface TextObject extends StudioObjectBase {
  type: 'text'
  text: string
  width: number // wrap width; height is auto
  fontSize: number
  fontFamily: string
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic'
  textDecoration: '' | 'underline'
  fill: string
  align: 'left' | 'center' | 'right'
}

export interface RectObject extends StudioObjectBase {
  type: 'rect'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export interface EllipseObject extends StudioObjectBase {
  type: 'ellipse'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineObject extends StudioObjectBase {
  type: 'line' | 'arrow'
  // Endpoint coordinates relative to (x, y)
  points: [number, number, number, number]
  stroke: string
  strokeWidth: number
}

export type StudioObject = ImageObject | TextObject | RectObject | EllipseObject | LineObject

export interface StudioSlide {
  id: string
  name: string
  heading: string
  sortOrder: number
  objects: StudioObject[]
}

export interface BoardLastState {
  slideId: string | null
  zoom: number
  panX: number
  panY: number
}

export interface StudioBoardRow {
  id: string
  org_id: string
  client_id: string
  project_id: string | null // optional link, used by future quote/procurement sprints
  name: string
  last_state: BoardLastState | null
}

export interface StudioSlideRow {
  id: string
  board_id: string
  org_id: string
  name: string
  heading: string
  sort_order: number
  objects: StudioObject[]
}

export function slideFromRow(row: StudioSlideRow): StudioSlide {
  return {
    id: row.id,
    name: row.name,
    heading: row.heading,
    sortOrder: row.sort_order,
    objects: Array.isArray(row.objects) ? row.objects : [],
  }
}
