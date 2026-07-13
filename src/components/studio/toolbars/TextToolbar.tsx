'use client'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Copy, Lock, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { FONT_FAMILIES } from '@/lib/studio/constants'
import type { TextObject } from '@/lib/studio/types'
import { TBtn, TDivider, ColorControl } from './atoms'

const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80]

export function TextToolbar({ obj }: { obj: TextObject }) {
  const store = useStudioStore
  const bold = obj.fontStyle.includes('bold')
  const italic = obj.fontStyle.includes('italic')

  function setStyle(nextBold: boolean, nextItalic: boolean) {
    const fontStyle = nextBold && nextItalic ? 'bold italic' : nextBold ? 'bold' : nextItalic ? 'italic' : 'normal'
    store.getState().updateObject(obj.id, { fontStyle } as Partial<TextObject>)
  }

  return (
    <>
      <select
        title="Font"
        aria-label="Font"
        value={obj.fontFamily}
        onChange={e => store.getState().updateObject(obj.id, { fontFamily: e.target.value } as Partial<TextObject>)}
        className="h-8 text-xs rounded-md border border-[#D8D3C8] bg-white px-1 cursor-pointer text-[#2C2C2A] max-w-[110px]"
      >
        {FONT_FAMILIES.map(f => (
          <option key={f} value={f} style={{ fontFamily: f }}>
            {f}
          </option>
        ))}
      </select>
      <select
        title="Font size"
        aria-label="Font size"
        value={obj.fontSize}
        onChange={e => store.getState().updateObject(obj.id, { fontSize: Number(e.target.value) } as Partial<TextObject>)}
        className="h-8 text-xs rounded-md border border-[#D8D3C8] bg-white px-1 cursor-pointer text-[#2C2C2A]"
      >
        {(SIZES.includes(obj.fontSize) ? SIZES : [...SIZES, obj.fontSize].sort((a, b) => a - b)).map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <TDivider />
      <TBtn icon={Bold} label="Bold" active={bold} onClick={() => setStyle(!bold, italic)} />
      <TBtn icon={Italic} label="Italic" active={italic} onClick={() => setStyle(bold, !italic)} />
      <TBtn
        icon={Underline}
        label="Underline"
        active={obj.textDecoration === 'underline'}
        onClick={() =>
          store.getState().updateObject(obj.id, {
            textDecoration: obj.textDecoration === 'underline' ? '' : 'underline',
          } as Partial<TextObject>)
        }
      />
      <ColorControl
        label="Text colour"
        value={obj.fill}
        onChange={c => store.getState().updateObject(obj.id, { fill: c } as Partial<TextObject>)}
      />
      <TDivider />
      <TBtn icon={AlignLeft} label="Align left" active={obj.align === 'left'} onClick={() => store.getState().updateObject(obj.id, { align: 'left' } as Partial<TextObject>)} />
      <TBtn icon={AlignCenter} label="Align centre" active={obj.align === 'center'} onClick={() => store.getState().updateObject(obj.id, { align: 'center' } as Partial<TextObject>)} />
      <TBtn icon={AlignRight} label="Align right" active={obj.align === 'right'} onClick={() => store.getState().updateObject(obj.id, { align: 'right' } as Partial<TextObject>)} />
      <TDivider />
      <TBtn icon={ArrowUp} label="Bring forward" onClick={() => store.getState().bringForward(obj.id)} />
      <TBtn icon={ArrowDown} label="Send back" onClick={() => store.getState().sendBack(obj.id)} />
      <TBtn icon={Copy} label="Duplicate (⌘D)" onClick={() => store.getState().duplicateSelected()} />
      <TBtn icon={Lock} label="Lock" onClick={() => store.getState().updateObject(obj.id, { locked: true })} />
      <TBtn icon={Trash2} label="Delete" onClick={() => store.getState().deleteSelected()} />
    </>
  )
}
