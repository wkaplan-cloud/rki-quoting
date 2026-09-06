'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TEMPLATES = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'classic', label: 'Classic' },
  { key: 'bold',    label: 'Bold' },
] as const

const THEMES = [
  { key: 'warm',     label: 'Warm',     primary: '#1A1A18', accent: '#9A7B4F' },
  { key: 'navy',     label: 'Navy',     primary: '#1B3A5C', accent: '#2E6DA4' },
  { key: 'slate',    label: 'Slate',    primary: '#2D3748', accent: '#718096' },
  { key: 'forest',   label: 'Forest',   primary: '#1E3A2F', accent: '#2D6A4F' },
  { key: 'charcoal', label: 'Charcoal', primary: '#1C1C1C', accent: '#555555' },
] as const

type TemplateKey = typeof TEMPLATES[number]['key']
type ThemeKey = typeof THEMES[number]['key']

interface Props {
  orgId: string
  adminUserId: string
  logoUrl: string | null
  letterheadUrl: string | null
  letterheadFilename: string | null
  currentTemplate: string | null
  currentTheme: string | null
}

export function BrandingPanel({ orgId, adminUserId, logoUrl, letterheadUrl, letterheadFilename, currentTemplate, currentTheme }: Props) {
  const router = useRouter()

  const isCustomCurrent = currentTemplate && !TEMPLATES.some(t => t.key === currentTemplate)

  const [template, setTemplate] = useState<TemplateKey>(
    (TEMPLATES.some(t => t.key === currentTemplate) ? currentTemplate : 'minimal') as TemplateKey
  )
  const [theme, setTheme] = useState<ThemeKey>((currentTheme as ThemeKey) ?? 'warm')
  const [customKey, setCustomKey] = useState(isCustomCurrent ? (currentTemplate ?? '') : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Custom key takes precedence over the standard picker
  const activeTemplateKey = customKey.trim() || template
  const previewUrl = `/api/platform/studios/${orgId}/preview-pdf?template=${activeTemplateKey}&theme=${theme}`

  async function apply() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/platform/studios/${adminUserId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_template: activeTemplateKey, pdf_color_theme: theme }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      setSaved(true)
      toast.success(`Applied "${activeTemplateKey}" template to studio`)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-5 mb-6">
      <h2 className="text-xs text-[#6E6B63] uppercase tracking-wider mb-5">Branding & PDF Template</h2>

      {/* Logo + letterhead row */}
      {(logoUrl || letterheadUrl) && (
        <div className="flex flex-wrap gap-6 mb-6 pb-6 border-b border-[#DED8CC]">
          {logoUrl && (
            <div>
              <p className="text-xs text-[#6E6B63] mb-2">Logo</p>
              <a href={logoUrl} target="_blank" rel="noopener noreferrer" title="Click to view full size">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Studio logo" className="h-10 max-w-[140px] object-contain rounded border border-[#DED8CC] p-2 bg-[#EFEBE3] cursor-pointer hover:border-[#CFC7B8] transition-colors" />
              </a>
            </div>
          )}
          {letterheadUrl && (
            <div>
              <p className="text-xs text-[#6E6B63] mb-2">Letterhead</p>
              <div className="flex items-center gap-3 px-3 py-2 bg-[#EFEBE3] border border-[#DED8CC] rounded-lg">
                <div>
                  <p className="text-sm text-[#3F3D38]">{letterheadFilename ?? 'Uploaded file'}</p>
                  <p className="text-xs text-[#6E6B63] mt-0.5">Use as reference when building custom template</p>
                </div>
                <a
                  href={letterheadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-[#7E6036]/10 border border-[#C4A46B]/20 text-[#7E6036] text-xs font-medium rounded-lg hover:bg-[#7E6036]/20 transition-colors"
                >
                  <ExternalLink size={11} /> View
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current applied template */}
      {currentTemplate && (
        <p className="text-xs text-[#6E6B63] mb-4">
          Currently applied: <span className="font-mono text-[#3F3D38] bg-[#EFEBE3] px-1.5 py-0.5 rounded">{currentTemplate}</span>
          {isCustomCurrent && <span className="ml-2 text-[#7E6036]">custom</span>}
        </p>
      )}

      {/* Standard template picker */}
      <div className="mb-5">
        <p className="text-xs text-[#6E6B63] mb-3">Template</p>
        <div className="flex gap-2 flex-wrap">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTemplate(t.key); setCustomKey('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                activeTemplateKey === t.key
                  ? 'bg-[#7E6036]/15 border-[#C4A46B]/40 text-[#7E6036]'
                  : 'bg-[#EFEBE3] border-[#DED8CC] text-[#5C5A54] hover:border-[#CFC7B8] hover:text-[#3F3D38]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom template key input */}
      <div className="mb-5">
        <p className="text-xs text-[#6E6B63] mb-1.5">Custom template key</p>
        <p className="text-xs text-[#6E6B63] mb-2">After building a custom template with Claude, paste its key here (e.g. <span className="font-mono">custom_rki_studio</span>). This overrides the picker above.</p>
        <input
          type="text"
          value={customKey}
          onChange={e => setCustomKey(e.target.value)}
          placeholder="e.g. custom_rki_studio"
          className="w-full max-w-xs px-3 py-2 bg-[#EFEBE3] border border-[#DED8CC] rounded-lg text-sm text-[#2C2C2A] placeholder-white/20 font-mono focus:outline-none focus:border-[#7E6036]/40 transition-colors"
        />
        {customKey.trim() && (
          <p className="text-xs text-[#7E6036] mt-1.5">Custom key active — standard picker is overridden</p>
        )}
      </div>

      {/* Theme picker */}
      <div className="mb-6">
        <p className="text-xs text-[#6E6B63] mb-3">Colour Theme</p>
        <div className="flex gap-2 flex-wrap">
          {THEMES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors cursor-pointer ${
                theme === t.key
                  ? 'bg-[#7E6036]/15 border-[#C4A46B]/40 text-[#7E6036]'
                  : 'bg-[#EFEBE3] border-[#DED8CC] text-[#5C5A54] hover:border-[#CFC7B8] hover:text-[#3F3D38]'
              }`}
            >
              <span className="flex gap-1">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.primary }} />
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.accent }} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-[#EFEBE3] border border-[#DED8CC] text-[#3F3D38] text-sm rounded-lg hover:bg-[#E5DFD5] hover:text-[#1A1A18] transition-colors"
        >
          <ExternalLink size={13} />
          Preview PDF
        </a>
        <button
          type="button"
          onClick={apply}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#7E6036] text-white text-sm font-semibold rounded-lg hover:bg-[#5F4726] transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
          {saving ? 'Applying…' : saved ? 'Applied' : 'Apply to Studio'}
        </button>
        {saved && <span className="text-xs text-[#047857]">Saved — studio gets this on next PDF</span>}
      </div>
    </div>
  )
}
