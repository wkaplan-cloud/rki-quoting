export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 animate-pulse">
      {/* Header */}
      <div className="h-7 w-40 bg-[#D8D3C8] rounded mb-1" />
      <div className="h-4 w-64 bg-[#EDE9E1] rounded mb-8" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#D8D3C8] rounded-xl p-4">
            <div className="h-3 w-20 bg-[#EDE9E1] rounded mb-3" />
            <div className="h-7 w-12 bg-[#D8D3C8] rounded" />
          </div>
        ))}
      </div>

      {/* Project rows */}
      <div className="bg-white border border-[#D8D3C8] rounded-xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#EDE9E1] last:border-0">
            <div className="h-4 w-48 bg-[#EDE9E1] rounded" />
            <div className="h-4 w-24 bg-[#EDE9E1] rounded" />
            <div className="ml-auto h-5 w-16 bg-[#EDE9E1] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
