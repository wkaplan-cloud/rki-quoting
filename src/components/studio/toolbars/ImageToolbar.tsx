'use client'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { Crop, RotateCw, ImageUp, Copy, ArrowUp, ArrowDown, Lock, Trash2, Wand2, Undo2, Loader2, Maximize2 } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { replaceImage } from '@/lib/studio/images'
import { removeBackground, restoreOriginal, isBgRemoved } from '@/lib/studio/bgRemoval'
import { getMasterContentArea } from '@/lib/studio/masterThemes'
import { LOW_RES_DPI_THRESHOLD } from '@/lib/studio/printQuality'
import type { ImageObject } from '@/lib/studio/types'
import { TBtn, TDivider, ColorControl } from './atoms'

export function ImageToolbar({ obj }: { obj: ImageObject }) {
  const store = useStudioStore
  const fileRef = useRef<HTMLInputElement>(null)
  const bgState = useStudioStore(s => s.bgRemoval[obj.id])
  const bgRemoved = isBgRemoved(obj)

  // Largest on-page size at which this image still prints sharp: grow (or
  // shrink) uniformly until effective resolution hits the low-res floor,
  // capped to the master content area, keeping the image centred where it is.
  function maxPrintSize() {
    const { masterLayout } = store.getState()
    const area = getMasterContentArea(masterLayout)
    const srcW = obj.crop?.width ?? obj.naturalWidth
    const srcH = obj.crop?.height ?? obj.naturalHeight
    if (!srcW || !srcH || !obj.width || !obj.height) return
    const sDpi = Math.min(
      (srcW * 72) / (LOW_RES_DPI_THRESHOLD * obj.width),
      (srcH * 72) / (LOW_RES_DPI_THRESHOLD * obj.height)
    )
    const sArea = Math.min(area.width / obj.width, area.height / obj.height)
    const s = Math.min(sDpi, sArea)
    const width = obj.width * s
    const height = obj.height * s
    const cx = obj.x + obj.width / 2
    const cy = obj.y + obj.height / 2
    const x = Math.min(Math.max(cx - width / 2, area.x), area.x + area.width - width)
    const y = Math.min(Math.max(cy - height / 2, area.y), area.y + area.height - height)
    store.getState().updateObject(obj.id, { x, y, width, height })
    if (sArea < sDpi) toast.success('Sized to fill the page — still sharp for print')
    else if (s < 1) toast.success('Reduced to its maximum sharp print size')
    else toast.success('Enlarged to its maximum sharp print size')
  }

  async function onReplaceFile(file: File | undefined) {
    if (!file) return
    try {
      await toast.promise(replaceImage(obj.id, file), {
        loading: 'Replacing image…',
        success: 'Image replaced',
        error: (e: Error) => e.message || 'Could not replace image',
      })
    } catch {
      // toast.promise already surfaced it
    }
  }

  return (
    <>
      <TBtn icon={Crop} label="Crop" onClick={() => store.getState().setCropTarget(obj.id)} />
      <TBtn
        icon={RotateCw}
        label="Rotate 90°"
        onClick={() => store.getState().updateObject(obj.id, { rotation: (obj.rotation + 90) % 360 })}
      />
      <TBtn icon={Maximize2} label="Max print size — as large as it can go and still print sharp" onClick={maxPrintSize} />
      <TBtn icon={ImageUp} label="Replace image" onClick={() => fileRef.current?.click()} />
      {bgRemoved ? (
        <TBtn icon={Undo2} label="Restore original" onClick={() => restoreOriginal(obj.id)} />
      ) : (
        <TBtn
          icon={bgState === 'processing' ? Loader2 : Wand2}
          label={bgState === 'error' ? 'Remove background — retry' : 'Remove background'}
          active={bgState === 'processing'}
          spin={bgState === 'processing'}
          onClick={() => {
            if (bgState !== 'processing') void removeBackground(obj.id)
          }}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.heic,.heif"
        className="hidden"
        onChange={e => {
          void onReplaceFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <TDivider />
      <ColorControl
        label="Border colour"
        value={obj.borderColor ?? '#2C2C2A'}
        onChange={c => store.getState().updateObject(obj.id, { borderColor: c, borderWidth: obj.borderWidth || 2 } as Partial<ImageObject>)}
      />
      <select
        title="Border width"
        aria-label="Border width"
        value={obj.borderWidth ?? 0}
        onChange={e => store.getState().updateObject(obj.id, { borderWidth: Number(e.target.value) } as Partial<ImageObject>)}
        className="h-8 text-xs rounded-md border border-[#D8D3C8] bg-white px-1 cursor-pointer text-[#2C2C2A]"
      >
        {[0, 1, 2, 4, 6].map(w => (
          <option key={w} value={w}>
            {w === 0 ? 'No border' : `${w}pt`}
          </option>
        ))}
      </select>
      <TDivider />
      <TBtn icon={ArrowUp} label="Bring forward" onClick={() => store.getState().bringForward(obj.id)} />
      <TBtn icon={ArrowDown} label="Send back" onClick={() => store.getState().sendBack(obj.id)} />
      <TBtn icon={Copy} label="Duplicate (⌘D)" onClick={() => store.getState().duplicateSelected()} />
      <TBtn icon={Lock} label="Lock" onClick={() => store.getState().updateObject(obj.id, { locked: true })} />
      <TBtn icon={Trash2} label="Delete" onClick={() => store.getState().deleteSelected()} />
    </>
  )
}
