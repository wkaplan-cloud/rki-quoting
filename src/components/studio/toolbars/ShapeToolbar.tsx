'use client'
import { Copy, Lock, Trash2, ArrowUpToLine, ArrowDownToLine } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { RectObject, EllipseObject, LineObject, CrossObject } from '@/lib/studio/types'
import { TBtn, TDivider, ColorControl } from './atoms'

export function ShapeToolbar({ obj }: { obj: RectObject | EllipseObject | LineObject | CrossObject }) {
  const store = useStudioStore
  // Stroke-only shapes: no fill control, "Line colour"/width labelling
  const isLine = obj.type === 'line' || obj.type === 'arrow' || obj.type === 'cross'

  return (
    <>
      {!isLine && (
        <ColorControl
          label="Fill"
          value={(obj as RectObject).fill}
          onChange={c => store.getState().updateObject(obj.id, { fill: c } as Partial<RectObject>)}
          allowNone
        />
      )}
      <ColorControl
        label={isLine ? 'Line colour' : 'Border colour'}
        value={obj.stroke}
        onChange={c => store.getState().updateObject(obj.id, { stroke: c } as Partial<RectObject>)}
      />
      <select
        title={isLine ? 'Line width' : 'Border width'}
        aria-label={isLine ? 'Line width' : 'Border width'}
        value={obj.strokeWidth}
        onChange={e => store.getState().updateObject(obj.id, { strokeWidth: Number(e.target.value) } as Partial<RectObject>)}
        className="h-8 text-xs rounded-md border border-[#D8D3C8] bg-white px-1 cursor-pointer text-[#2C2C2A]"
      >
        {(isLine ? [1, 2, 3, 4, 6, 8] : [0, 1, 2, 4, 6]).map(w => (
          <option key={w} value={w}>
            {w === 0 ? 'No border' : `${w}pt`}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1 px-1" title="Opacity">
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(obj.opacity * 100)}
          onChange={e => store.getState().updateObject(obj.id, { opacity: Number(e.target.value) / 100 })}
          className="w-16 accent-[#9A7B4F] cursor-pointer"
          aria-label="Opacity"
        />
      </div>
      <TDivider />
      <TBtn icon={ArrowUpToLine} label="Bring to front" onClick={() => store.getState().bringToFront(obj.id)} />
      <TBtn icon={ArrowDownToLine} label="Send to back" onClick={() => store.getState().sendToBack(obj.id)} />
      <TBtn icon={Copy} label="Duplicate (⌘D)" onClick={() => store.getState().duplicateSelected()} />
      <TBtn icon={Lock} label="Lock" onClick={() => store.getState().updateObject(obj.id, { locked: true })} />
      <TBtn icon={Trash2} label="Delete" onClick={() => store.getState().deleteSelected()} />
    </>
  )
}
