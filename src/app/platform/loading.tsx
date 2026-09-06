/** Mirrors the dashboard's bands so the page doesn't jump when data lands. */
export default function Loading() {
  return (
    <div className="p-6 sm:p-8 max-w-[1400px] w-full" aria-busy="true" aria-label="Loading">
      <div className="mb-6 space-y-2">
        <div className="qh-skeleton h-7 w-52 rounded-lg" />
        <div className="qh-skeleton h-3.5 w-80 rounded" />
      </div>

      <div className="mb-8 border-y border-white/8 flex flex-wrap divide-x divide-white/8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 py-4 first:pl-0 space-y-2">
            <div className="qh-skeleton h-2.5 w-24 rounded" />
            <div className="qh-skeleton h-5 w-28 rounded" />
            <div className="qh-skeleton h-2.5 w-20 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <div className="xl:col-span-2 qh-skeleton h-64 rounded-2xl" />
        <div className="qh-skeleton h-64 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="qh-skeleton h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
