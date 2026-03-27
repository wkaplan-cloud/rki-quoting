'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, CheckCircle } from 'lucide-react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      getResponse: (widgetId: string) => string | undefined
    }
  }
}

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [trap, setTrap] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) return

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'normal',
        })
      }
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [siteKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cfToken = siteKey && widgetId.current
      ? window.turnstile?.getResponse(widgetId.current)
      : undefined

    if (siteKey && !cfToken) {
      setError('Please complete the security check.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, _trap: trap, cf_token: cfToken }),
      })
      if (!res.ok) {
        const d = await res.json()
        if (widgetId.current) window.turnstile?.reset(widgetId.current)
        throw new Error(d.error || 'Failed to send')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle size={36} className="text-[#C4A46B] mb-4" />
        <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Message sent</h3>
        <p className="text-sm text-[#8A877F]">We&apos;ll get back to you as soon as possible.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        name="_trap"
        value={trap}
        onChange={e => setTrap(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-[#D8D3C8] rounded-lg bg-white text-[#1A1A18] focus:outline-none focus:border-[#9A7B4F] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Email <span className="text-[#C4A46B]">*</span></label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-[#D8D3C8] rounded-lg bg-white text-[#1A1A18] focus:outline-none focus:border-[#9A7B4F] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">Message <span className="text-[#C4A46B]">*</span></label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-[#D8D3C8] rounded-lg bg-white text-[#1A1A18] focus:outline-none focus:border-[#9A7B4F] transition-colors resize-none"
        />
      </div>

      {/* Turnstile widget — only renders when site key is configured */}
      {siteKey && <div ref={turnstileRef} />}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending…' : <><Send size={14} /> Send message</>}
      </button>
    </form>
  )
}
