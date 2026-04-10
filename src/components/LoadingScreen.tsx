export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EC] gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="QuotingHub" className="h-12 w-auto object-contain opacity-80" />
      <div className="flex items-center gap-2 text-sm text-[#9A7B4F]">
        <div className="w-4 h-4 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
        Loading…
      </div>
    </div>
  )
}
