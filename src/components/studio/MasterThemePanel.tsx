'use client'
import { Palette } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { MASTER_THEMES } from '@/lib/studio/masterThemes'
import { Switch } from '@/components/ui/Switch'
import { Select } from '@/components/ui/Select'

const MIN_BINDING_MM = 15
const MAX_BINDING_MM = 60

// Board-wide Master Page settings — slide-in panel toggled from the header,
// same pattern as Assets/Specs. Every board always has an active theme;
// this panel picks which one and which of its elements to show. Every
// control writes straight to the store (instant live preview) and
// autosaves via setMasterLayout.
export function MasterThemePanel() {
  const masterLayout = useStudioStore(s => s.masterLayout)
  const setMasterLayout = useStudioStore(s => s.setMasterLayout)

  return (
    <div className="flex-shrink-0 w-[280px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          <Palette size={12} /> Master Theme
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <Select
          label="Theme"
          value={masterLayout.themeId}
          onChange={e => setMasterLayout({ themeId: e.target.value })}
        >
          {Object.values(MASTER_THEMES).map(theme => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </Select>

        <div className="h-px bg-[#D8D3C8]" />

        <Row label="Show Border">
          <Switch checked={masterLayout.showBorder} onChange={v => setMasterLayout({ showBorder: v })} label="Show Border" />
        </Row>
        <Row label="Show Header">
          <Switch checked={masterLayout.showHeader} onChange={v => setMasterLayout({ showHeader: v })} label="Show Header" />
        </Row>
        <Row label="Show Footer">
          <Switch checked={masterLayout.showFooter} onChange={v => setMasterLayout({ showFooter: v })} label="Show Footer" />
        </Row>
        <Row label="Show Company Logo" disabled={!masterLayout.showFooter}>
          <Switch
            checked={masterLayout.showLogo}
            onChange={v => setMasterLayout({ showLogo: v })}
            disabled={!masterLayout.showFooter}
            label="Show Company Logo"
          />
        </Row>
        <Row label="Show Page Numbers" disabled={!masterLayout.showFooter}>
          <Switch
            checked={masterLayout.showPageNumber}
            onChange={v => setMasterLayout({ showPageNumber: v })}
            disabled={!masterLayout.showFooter}
            label="Show Page Numbers"
          />
        </Row>

        <div className="h-px bg-[#D8D3C8]" />

        <label className="block">
          <span className="block text-[10px] text-[#8A877F] mb-0.5">Binding Margin (mm)</span>
          <input
            type="number"
            min={MIN_BINDING_MM}
            max={MAX_BINDING_MM}
            step={1}
            value={masterLayout.bindingMarginMm}
            onChange={e => {
              const raw = Number(e.target.value)
              if (Number.isNaN(raw)) return
              const clamped = Math.min(MAX_BINDING_MM, Math.max(MIN_BINDING_MM, raw))
              setMasterLayout({ bindingMarginMm: clamped })
            }}
            className="w-full text-[12px] px-2.5 py-2 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
          <p className="text-[10px] text-[#8A877F] mt-1">
            Extra left-side margin for comb/wire binding on A3 prints. Default 35mm.
          </p>
        </label>
      </div>
    </div>
  )
}

function Row({
  label,
  disabled = false,
  children,
}: {
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12px] ${disabled ? 'text-[#C4BFB5]' : 'text-[#2C2C2A]'}`}>{label}</span>
      {children}
    </div>
  )
}
