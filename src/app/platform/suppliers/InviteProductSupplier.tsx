'use client'

import { useState } from 'react'
import { Link2, Check, Copy } from 'lucide-react'

/**
 * A product supplier cannot sign themselves up — the public chooser offers only
 * Electrician and Manufacturer / Workshop. This is the deliberate back door:
 * the register form still accepts ?type=manufacturer, and this hands you that
 * link so the query string does not have to live in anyone's memory.
 */
export function InviteProductSupplier() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Built on click, not at render — the server has no window to read.
  const link = () => `${window.location.origin}/supplier-portal/register?type=manufacturer`

  function copy() {
    navigator.clipboard.writeText(link()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#DED8CC] bg-[#FDFCF9] text-[13px] text-[#3F3D38] hover:border-[#7E6036]/50 hover:bg-white transition-colors duration-150 cursor-pointer"
      >
        <Link2 size={14} className="text-[#7E6036]" />
        Invite a product supplier
      </button>

      {open && (
        <div className="mt-2 w-full sm:w-[26rem] rounded-xl border border-[#DED8CC] bg-[#FDFCF9] p-4 shadow-[0_1px_2px_0_rgba(44,44,42,0.04),0_8px_24px_-16px_rgba(44,44,42,0.16)]">
          <p className="text-[12px] text-[#5C5A54] leading-relaxed mb-3">
            Product suppliers cannot sign up from the site — the public chooser offers only
            Electrician and Manufacturer&nbsp;/&nbsp;Workshop. Send this link instead. They get a
            price list you can pull from; studios still reach them by email.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-[#EFEBE3] px-3 py-2 text-[11px] text-[#3F3D38]">
              /supplier-portal/register?type=manufacturer
            </code>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7E6036] text-white text-[12px] font-medium hover:bg-[#5F4726] transition-colors duration-150 cursor-pointer shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
