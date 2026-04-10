import Image from 'next/image'

export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EC] gap-4">
      <Image
        src="/logo.png"
        alt="QuotingHub"
        width={240}
        height={96}
        className="h-24 w-auto object-contain opacity-80"
        priority
      />
      <div className="flex items-center gap-2 text-sm text-[#9A7B4F]">
        <div className="w-4 h-4 rounded-full border-2 border-[#9A7B4F] border-t-transparent animate-spin" />
        Loading…
      </div>
    </div>
  )
}
