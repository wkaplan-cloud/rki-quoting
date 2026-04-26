'use client'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full bg-white border border-[#EDE9E1] rounded-lg p-8 text-center">
        <p className="text-xs font-medium text-[#C4A46B] uppercase tracking-widest mb-2">Page error</p>
        <h2 className="text-xl font-semibold text-[#1A1A18] mb-3">Something went wrong</h2>
        <p className="text-sm text-[#8A877F] leading-relaxed mb-6">
          This page encountered an error. Your data is safe — try refreshing or click below to retry.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre className="text-left text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-6 overflow-auto">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm border border-[#D8D3C8] rounded text-[#4A4A47] hover:bg-[#F5F2EC] transition-colors"
          >
            Refresh page
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-[#2C2C2A] text-[#F5F2EC] rounded font-medium hover:bg-[#9A7B4F] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
