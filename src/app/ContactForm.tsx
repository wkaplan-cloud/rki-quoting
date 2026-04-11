'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, CheckCircle } from 'lucide-react'
import Script from 'next/script'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [trap, setTrap] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Explicitly render the widget on mount — handles client-side navigation
  // where the auto-scan already ran before this component mounted
  useEffect(() => {
    if (!siteKey) return
    function render() {
      if (!widgetRef.current || !(window as any).turnstile) return
      if (widgetId.current != null) return // already rendered
      widgetId.current = (window as any).turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        theme: 'light',
        size: 'invisible',
      })
    }
    if ((window as any).turnstile) {
      render()
    } else {
      // Script not yet loaded — attach a callback it will call on ready
      const prev = (window as any).onloadTurnstileCallback
      ;(window as any).onloadTurnstileCallback = () => {
        render()
        if (prev) prev()
      }
    }
    return () => {
      if (widgetId.current != null && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [siteKey])

  // Reset widget after failed submit
  useEffect(() => {
    if (error && siteKey && (window as any).turnstile && widgetId.current != null) {
      (window as any).turnstile.reset(widgetId.current)
    }
  }, [error, siteKey])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Get token from the hidden input Turnstile injects
    const form = e.target as HTMLFormElement
    const cfToken = siteKey
      ? (form.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value
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
    <>
      {siteKey && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" strategy="lazyOnload" />
      )}
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

      {/* Turnstile widget — invisible, explicitly rendered via ref */}
      {siteKey && <div ref={widgetRef} />}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Sending…' : <><Send size={14} /> Send message</>}
      </button>
    </form>
    </>
  )
}
