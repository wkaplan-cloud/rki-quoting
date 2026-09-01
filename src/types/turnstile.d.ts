// Cloudflare Turnstile is loaded from a <script> tag, so it only exists on
// `window` at runtime. Declaring the slice of its API we actually call means
// the signup, register and contact forms can use it without casting through
// `any` — and a typo in a method name becomes a build error.

interface TurnstileRenderOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string
  remove(widgetId: string): void
  reset(widgetId: string): void
  getResponse(widgetId: string): string | undefined
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onloadTurnstileCallback?: () => void
  }
}

export {}
