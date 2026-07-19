'use client'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { Type, Square, Circle, Minus, MoveUpRight, X, ImagePlus } from 'lucide-react'
import { useStudioStore, newId } from '@/lib/studio/store'
import { importImageFiles } from '@/lib/studio/images'
import { PAGE_W, PAGE_H, OBJECT_DEFAULTS, DEFAULT_FONT } from '@/lib/studio/constants'
import type { StudioObject } from '@/lib/studio/types'
import { TBtn, TDivider } from './toolbars/atoms'

const CX = PAGE_W / 2
const CY = PAGE_H / 2

function base() {
  return { id: newId(), rotation: 0, opacity: 1, locked: false }
}

const makers: Record<string, () => StudioObject> = {
  text: () => ({
    ...base(),
    type: 'text',
    x: CX - 120,
    y: CY - 16,
    width: 240,
    text: 'Text',
    fontSize: OBJECT_DEFAULTS.fontSize,
    fontFamily: DEFAULT_FONT,
    fontStyle: 'normal',
    textDecoration: '',
    fill: OBJECT_DEFAULTS.textFill,
    align: 'left',
  }),
  rect: () => ({
    ...base(),
    type: 'rect',
    x: CX - 120,
    y: CY - 80,
    width: 240,
    height: 160,
    fill: OBJECT_DEFAULTS.shapeFill,
    stroke: OBJECT_DEFAULTS.shapeStroke,
    strokeWidth: 0,
    cornerRadius: 0,
  }),
  ellipse: () => ({
    ...base(),
    type: 'ellipse',
    x: CX - 90,
    y: CY - 90,
    width: 180,
    height: 180,
    fill: OBJECT_DEFAULTS.shapeFill,
    stroke: OBJECT_DEFAULTS.shapeStroke,
    strokeWidth: 0,
  }),
  line: () => ({
    ...base(),
    type: 'line',
    x: CX - 120,
    y: CY,
    points: [0, 0, 240, 0],
    stroke: OBJECT_DEFAULTS.shapeStroke,
    strokeWidth: OBJECT_DEFAULTS.strokeWidth,
  }),
  arrow: () => ({
    ...base(),
    type: 'arrow',
    x: CX - 120,
    y: CY,
    points: [0, 0, 240, 0],
    stroke: OBJECT_DEFAULTS.shapeStroke,
    strokeWidth: OBJECT_DEFAULTS.strokeWidth,
  }),
  cross: () => ({
    ...base(),
    type: 'cross',
    x: CX - 60,
    y: CY - 60,
    width: 120,
    height: 120,
    stroke: OBJECT_DEFAULTS.shapeStroke,
    strokeWidth: OBJECT_DEFAULTS.strokeWidth,
  }),
}

// Fixed insert toolbar at the top of the canvas area
export function InsertBar() {
  const fileRef = useRef<HTMLInputElement>(null)

  function insert(kind: keyof typeof makers) {
    const obj = makers[kind]()
    useStudioStore.getState().addObjects([obj])
    if (obj.type === 'text') useStudioStore.getState().setEditingText(obj.id)
  }

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 bg-white rounded-xl border border-[#D8D3C8] px-1.5 py-1"
      style={{ boxShadow: '0 2px 8px rgba(26,26,24,0.08), 0 8px 24px rgba(26,26,24,0.1)' }}
    >
      <TBtn icon={Type} label="Text" onClick={() => insert('text')} />
      <TDivider />
      <TBtn icon={Square} label="Rectangle" onClick={() => insert('rect')} />
      <TBtn icon={Circle} label="Circle" onClick={() => insert('ellipse')} />
      <TBtn icon={Minus} label="Line" onClick={() => insert('line')} />
      <TBtn icon={MoveUpRight} label="Arrow" onClick={() => insert('arrow')} />
      <TBtn icon={X} label="Cross" onClick={() => insert('cross')} />
      <TDivider />
      <TBtn icon={ImagePlus} label="Add images" onClick={() => fileRef.current?.click()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.heic,.heif"
        multiple
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) {
            void toast.promise(importImageFiles(files), {
              loading: files.length > 1 ? `Importing ${files.length} images…` : 'Importing image…',
              success: 'Images added',
              error: (err: Error) => err.message || 'Import failed',
            })
          }
        }}
      />
    </div>
  )
}
