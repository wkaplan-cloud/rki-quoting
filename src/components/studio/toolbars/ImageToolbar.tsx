'use client'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { Crop, RotateCw, ImageUp, Copy, ArrowUp, ArrowDown, Lock, Trash2, Wand2, Undo2, Loader2 } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { replaceImage } from '@/lib/studio/images'
import { removeBackground, restoreOriginal, isBgRemoved } from '@/lib/studio/bgRemoval'
import type { ImageObject } from '@/lib/studio/types'
import { TBtn, TDivider, ColorControl } from './atoms'

export function ImageToolbar({ obj }: { obj: ImageObject }) {
  const store = useStudioStore
  const fileRef = useRef<HTMLInputElement>(null)
  const bgState = useStudioStore(s => s.bgRemoval[obj.id])
  const bgRemoved = isBgRemoved(obj)

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
